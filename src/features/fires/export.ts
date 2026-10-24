/**
 * Downloads of the detections on screen, as CSV and GeoJSON. Pure, so the
 * formats can be tested; the panel turns the strings into files.
 */
import type { Feature, FeatureCollection, Point } from "geojson";
import { sensorOf } from "./inpe";
import type { FiresResponse } from "./schemas";
import { type FireGroups, SENSOR_LABELS } from "./view";

export const ATTRIBUTION =
	"Focos de calor: INPE, Programa Queimadas (https://terrabrasilis.dpi.inpe.br/queimadas/portal/). Processado por FocosBR.";

/** One exported detection. Column names follow INPE's where it has one. */
export type ExportRow = {
	/** Estimated fire this detection belongs to (same id = same fire). */
	id_fogo: number;
	data_hora_utc: string;
	data_hora_brasilia: string;
	latitude: number;
	longitude: number;
	satelite: string;
	sensor: string;
	municipio: string;
	uf: string;
	bioma: string;
	frp_mw: number | null;
	dias_sem_chuva: number | null;
	precipitacao_mm: number | null;
	risco_fogo: number | null;
	/** 1 = from INPE's 10-minute files, not yet in its daily file. */
	preliminar: 0 | 1;
};

const BRASILIA = new Intl.DateTimeFormat("en-CA", {
	timeZone: "America/Sao_Paulo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

/** "2026-10-24 02:30" in Brasília time. */
function brasiliaTime(ms: number): string {
	const p = Object.fromEntries(
		BRASILIA.formatToParts(ms).map((x) => [x.type, x.value]),
	);
	return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** The given detections as export rows, oldest first. */
export function exportRows(
	data: FiresResponse,
	indices: number[],
	groups: FireGroups,
): ExportRow[] {
	const f = data.fires;
	return indices.map((i) => {
		const satellite = data.satellites[f.sat[i] ?? -1] ?? "";
		const ms = (f.t[i] ?? 0) * 1000;
		return {
			id_fogo: groups.groupOf.get(i) ?? i,
			data_hora_utc: new Date(ms).toISOString(),
			data_hora_brasilia: brasiliaTime(ms),
			latitude: f.lat[i] ?? 0,
			longitude: f.lon[i] ?? 0,
			satelite: satellite,
			sensor: SENSOR_LABELS[sensorOf(satellite)],
			// "Altamira (PA)" → "Altamira"; the state has its own column.
			municipio: (data.places[f.place[i] ?? -1] ?? "").replace(
				/ \([A-Z]{2}\)$/,
				"",
			),
			uf: data.states[f.state[i] ?? -1] ?? "",
			bioma: data.biomes[f.biome[i] ?? -1] ?? "",
			frp_mw: f.frp[i] ?? null,
			dias_sem_chuva: f.dry[i] ?? null,
			precipitacao_mm: f.rain[i] ?? null,
			risco_fogo: f.risk[i] ?? null,
			preliminar: f.prelim[i] === 1 ? 1 : 0,
		};
	});
}

const COLUMNS: (keyof ExportRow)[] = [
	"id_fogo",
	"data_hora_utc",
	"data_hora_brasilia",
	"latitude",
	"longitude",
	"satelite",
	"sensor",
	"municipio",
	"uf",
	"bioma",
	"frp_mw",
	"dias_sem_chuva",
	"precipitacao_mm",
	"risco_fogo",
	"preliminar",
];

/** RFC 4180: quote fields with a comma, quote or line break; double quotes. */
function csvField(value: string | number | null): string {
	if (value === null) return "";
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * CSV with a header row and a BOM, so spreadsheet apps read the accents as
 * UTF-8. Missing values are empty fields; decimals use a dot.
 */
export function toCsv(rows: ExportRow[]): string {
	const lines = [COLUMNS.join(",")];
	for (const row of rows)
		lines.push(COLUMNS.map((c) => csvField(row[c])).join(","));
	return `﻿${lines.join("\r\n")}\r\n`;
}

/** A GeoJSON FeatureCollection, `[longitude, latitude]` points. */
export function toGeoJson(rows: ExportRow[]): FeatureCollection<
	Point,
	Omit<ExportRow, "latitude" | "longitude">
> & {
	attribution: string;
} {
	return {
		type: "FeatureCollection",
		attribution: ATTRIBUTION,
		features: rows.map(
			({
				latitude,
				longitude,
				...properties
			}): Feature<Point, Omit<ExportRow, "latitude" | "longitude">> => ({
				type: "Feature",
				geometry: { type: "Point", coordinates: [longitude, latitude] },
				properties,
			}),
		),
	};
}

/** ASCII slug for file names: "São Félix do Xingu (PA)" → "sao-felix-do-xingu-pa". */
function slug(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** "focos-pa-cerrado-24h-20261024-0230.csv": region, window and when. */
export function exportFileName(
	ext: "csv" | "geojson",
	region: { uf?: string; biome?: string; place?: string },
	hours: number,
	now: Date,
): string {
	const where = [region.place ?? region.uf, region.biome]
		.filter((x): x is string => !!x)
		.map(slug);
	const stamp = brasiliaTime(now.getTime())
		.replace(/[-:]/g, "")
		.replace(" ", "-");
	const name = [
		"focos",
		...(where.length ? where : ["brasil"]),
		`${hours}h`,
		stamp,
	];
	return `${name.join("-")}.${ext}`;
}
