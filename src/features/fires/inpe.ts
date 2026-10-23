/**
 * INPE Programa Queimadas: parsing and shaping of the daily Brazil hotspot
 * files. Pure, so it can be tested without the network.
 *
 * Source: https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/
 * One CSV per UTC day, rewritten about every 10 minutes while the day lasts.
 */
import type { FiresResponse, Sensor, Window } from "./schemas";

export const INPE_DAILY_BASE =
	"https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil";

export type Detection = {
	lat: number;
	lon: number;
	/** Unix milliseconds. */
	time: number;
	satellite: string;
	state: string;
	place: string;
	biome: string;
	frp: number | null;
};

/** IBGE state codes (INPE's `estado_id`) to their two-letter abbreviations. */
const UF_BY_IBGE: Record<string, string> = {
	"11": "RO",
	"12": "AC",
	"13": "AM",
	"14": "RR",
	"15": "PA",
	"16": "AP",
	"17": "TO",
	"21": "MA",
	"22": "PI",
	"23": "CE",
	"24": "RN",
	"25": "PB",
	"26": "PE",
	"27": "AL",
	"28": "SE",
	"29": "BA",
	"31": "MG",
	"32": "ES",
	"33": "RJ",
	"35": "SP",
	"41": "PR",
	"42": "SC",
	"43": "RS",
	"50": "MS",
	"51": "MT",
	"52": "GO",
	"53": "DF",
};

export function dailyFileUrl(day: Date): string {
	const ymd = day.toISOString().slice(0, 10).replaceAll("-", "");
	return `${INPE_DAILY_BASE}/focos_diario_br_${ymd}.csv`;
}

/** The UTC days a window ending at `now` touches, oldest first. */
export function daysForWindow(now: Date, hours: number): Date[] {
	const start = new Date(now.getTime() - hours * 3_600_000);
	const days: Date[] = [];
	for (
		let d = Date.UTC(
			start.getUTCFullYear(),
			start.getUTCMonth(),
			start.getUTCDate(),
		);
		d <= now.getTime();
		d += 86_400_000
	)
		days.push(new Date(d));
	return days;
}

const LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "d'"]);

/** "SÃO JOSÉ DO RIO PRETO" → "São José do Rio Preto". */
export function titleCase(name: string): string {
	return name
		.toLocaleLowerCase("pt-BR")
		.split(" ")
		.filter(Boolean)
		.map((word, i) =>
			i > 0 && LOWERCASE_WORDS.has(word)
				? word
				: word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1),
		)
		.join(" ");
}

/** "2026-10-23 20:40:00" (GMT) → Unix ms; NaN when malformed. */
export function parseGmt(value: string): number {
	return Date.parse(`${value.trim().replace(" ", "T")}Z`);
}

/**
 * Parses one daily file. Columns are found by header name, so a reordering
 * upstream doesn't silently shift fields; rows that don't fit are skipped.
 */
export function parseInpeCsv(text: string): Detection[] {
	const lines = text.split(/\r?\n/);
	const header = lines[0]?.split(",").map((h) => h.trim()) ?? [];
	const col = (name: string) => header.indexOf(name);
	const idx = {
		lat: col("lat"),
		lon: col("lon"),
		time: col("data_hora_gmt"),
		satellite: col("satelite"),
		municipality: col("municipio"),
		stateId: col("estado_id"),
		biome: col("bioma"),
		frp: col("frp"),
	};
	if (Object.values(idx).some((i) => i < 0))
		throw new Error(`Unexpected INPE header: ${lines[0]}`);

	const out: Detection[] = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const f = line.split(",");
		if (f.length !== header.length) continue;
		const lat = Number(f[idx.lat]);
		const lon = Number(f[idx.lon]);
		const time = parseGmt(f[idx.time] ?? "");
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || Number.isNaN(time))
			continue;
		const state = UF_BY_IBGE[f[idx.stateId]?.trim() ?? ""] ?? "";
		const municipality = titleCase(f[idx.municipality] ?? "");
		const frpText = f[idx.frp]?.trim() ?? "";
		const frp = frpText === "" ? null : Number(frpText);
		out.push({
			lat,
			lon,
			time,
			satellite: f[idx.satellite]?.trim() ?? "",
			state,
			place: state ? `${municipality} (${state})` : municipality,
			biome: f[idx.biome]?.trim() ?? "",
			frp: frp !== null && Number.isFinite(frp) ? frp : null,
		});
	}
	return out;
}

/** Groups INPE's satellite names into the sensor families the map filters on. */
export function sensorOf(satellite: string): Sensor {
	if (/^(NPP|NOAA-2\d)/.test(satellite)) return "viirs";
	if (/^(AQUA|TERRA)/.test(satellite)) return "modis";
	if (satellite.startsWith("GOES")) return "goes";
	if (satellite.startsWith("METOP")) return "metop";
	if (satellite.startsWith("MSG")) return "msg";
	return "other";
}

/**
 * Keeps the detections inside the window and packs them for the client,
 * oldest first so the newest draw on top.
 */
export function buildFiresResponse(
	detections: Detection[],
	now: Date,
	hours: Window,
): FiresResponse {
	const end = now.getTime();
	const start = end - hours * 3_600_000;
	const kept = detections
		.filter((d) => d.time > start && d.time <= end)
		.sort((a, b) => a.time - b.time);

	const tables = {
		satellites: new Map<string, number>(),
		states: new Map<string, number>(),
		places: new Map<string, number>(),
		biomes: new Map<string, number>(),
	};
	const indexIn = (table: Map<string, number>, value: string) => {
		let i = table.get(value);
		if (i === undefined) {
			i = table.size;
			table.set(value, i);
		}
		return i;
	};

	const fires: FiresResponse["fires"] = {
		lon: [],
		lat: [],
		t: [],
		frp: [],
		sat: [],
		state: [],
		place: [],
		biome: [],
	};
	for (const d of kept) {
		fires.lon.push(d.lon);
		fires.lat.push(d.lat);
		fires.t.push(Math.round(d.time / 1000));
		fires.frp.push(d.frp);
		fires.sat.push(indexIn(tables.satellites, d.satellite));
		fires.state.push(indexIn(tables.states, d.state));
		fires.place.push(indexIn(tables.places, d.place));
		fires.biome.push(indexIn(tables.biomes, d.biome));
	}

	const latest = kept.at(-1);
	return {
		generatedAt: now.toISOString(),
		hours,
		latestAt: latest ? new Date(latest.time).toISOString() : null,
		satellites: [...tables.satellites.keys()],
		states: [...tables.states.keys()],
		places: [...tables.places.keys()],
		biomes: [...tables.biomes.keys()],
		fires,
	};
}
