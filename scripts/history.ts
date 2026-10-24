/**
 * Fills the `history` collection the state and city pages read (see
 * src/features/history): detections per month since 2003 from INPE's
 * reference satellite, and per day from all satellites, for Brazil, each
 * state and each municipality.
 *
 * Daily (default): this month and last month from the monthly files (the
 * reference satellite by month, all satellites by day), then the last 31
 * days from the daily files, which are the freshest. GitHub Actions runs it
 * every morning.
 *
 * Backfill (--backfill, once): every year since 2003 from the yearly
 * reference-satellite files (or a year's monthly files when INPE hasn't
 * published its yearly file yet), and days since January 2023 from the
 * monthly files.
 *
 * Each run sets the exact months and days it processed, so re-running is
 * safe, then refreshes every region's year-to-date summary (`ytd`). Completed years and months are cached in .cache/history.
 *
 * Usage: pnpm history:build [--backfill]   (needs MONGODB_URI)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { parseGmt, UF_BY_IBGE } from "../src/features/fires/inpe";
import { STATE_NAMES } from "../src/features/fires/states";
import {
	createHistoryAggregator,
	type HistoryDetection,
	RENAMED,
	ytdSummary,
} from "../src/features/history/build";
import {
	FIRST_YEAR,
	HISTORY_COLLECTION,
	REFERENCE_SATELLITE,
} from "../src/features/history/schemas";
import list from "../src/features/places/municipalities.json";
import {
	MunicipalityListSchema,
	municipalityIndex,
	slugify,
} from "../src/features/places/places";
import { closeDb, getDb } from "../src/lib/db.server";

const BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv";
const CACHE = ".cache/history";
/** The first month of INPE's monthly Brazil files. */
const FIRST_MONTHLY = { year: 2023, month: 1 };
const backfill = process.argv.includes("--backfill");

mkdirSync(CACHE, { recursive: true });
const now = new Date();
const aggregator = createHistoryAggregator();
const municipalities = municipalityIndex(MunicipalityListSchema.parse(list));
const ufByStateName = new Map(
	Object.entries(STATE_NAMES).map(([uf, name]) => [slugify(name), uf]),
);
const stats = { rows: 0, noState: 0, noCity: 0 };

/** Bytes of a URL, from the cache when `keep` and already there; null on 404. */
async function download(
	url: string,
	keep: boolean,
): Promise<Uint8Array | null> {
	const file = `${CACHE}/${url.split("/").at(-1)}`;
	if (keep && existsSync(file)) return readFileSync(file);
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url);
			if (res.status === 404) return null;
			if (!res.ok) throw new Error(`${res.status} ${url}`);
			const bytes = new Uint8Array(await res.arrayBuffer());
			if (keep) writeFileSync(file, bytes);
			return bytes;
		} catch (err) {
			if (attempt >= 3) throw err;
			console.warn(`retrying ${url}:`, String(err));
			await new Promise((r) => setTimeout(r, 5000 * attempt));
		}
	}
}

/** A CSV's text, unzipping when needed. */
function csvText(bytes: Uint8Array, zipped: boolean): string {
	if (!zipped) return new TextDecoder().decode(bytes);
	const entry = Object.entries(unzipSync(bytes)).find(([n]) =>
		n.endsWith(".csv"),
	);
	if (!entry) throw new Error("zip without a CSV");
	return strFromU8(entry[1]);
}

/** Calls `row` with each data line's fields, looked up by header name. */
function eachRow(
	text: string,
	columns: string[],
	row: (get: (column: string) => string) => void,
) {
	let start = text.indexOf("\n") + 1;
	const header = text.slice(0, start).trim().split(",");
	const at = new Map(columns.map((c) => [c, header.indexOf(c)]));
	for (const [c, i] of at)
		if (i < 0) throw new Error(`missing column ${c} in ${header.join(",")}`);
	while (start < text.length) {
		let end = text.indexOf("\n", start);
		if (end < 0) end = text.length;
		const f = text.slice(start, end).split(",");
		start = end + 1;
		if (f.length !== header.length) continue;
		row((c) => (f[at.get(c) ?? -1] ?? "").trim());
	}
}

function add(d: HistoryDetection | null) {
	stats.rows++;
	if (!d) {
		stats.noState++;
		return;
	}
	if (d.cityId === undefined) stats.noCity++;
	aggregator.add(d);
}

/** Rows of a yearly reference file: names, no codes. */
function addYearly(text: string) {
	eachRow(text, ["data_pas", "estado", "municipio"], (get) => {
		const uf = ufByStateName.get(slugify(get("estado")));
		const time = parseGmt(get("data_pas"));
		if (!uf || Number.isNaN(time)) return add(null);
		const slug = slugify(get("municipio"));
		const renamed = RENAMED[`${uf}/${slug}`];
		const city = municipalities.find(uf, renamed ? slugify(renamed) : slug);
		add({ kind: "reference", time, uf, cityId: city?.id });
	});
}

/**
 * Rows of a monthly or daily file (they carry IBGE codes). Monthly files
 * give both series: the reference satellite by month (when `months`) and
 * every satellite by day (when `days`).
 */
function addCoded(text: string, { months = false, days = false }) {
	eachRow(
		text,
		["data_hora_gmt", "satelite", "estado_id", "municipio_id"],
		(get) => {
			const uf = UF_BY_IBGE[get("estado_id")];
			const time = parseGmt(get("data_hora_gmt"));
			if (!uf || Number.isNaN(time)) return add(null);
			const id = Number(get("municipio_id"));
			const cityId = municipalities.byId.has(id) ? id : undefined;
			if (months && get("satelite") === REFERENCE_SATELLITE)
				aggregator.add({ kind: "reference", time, uf, cityId });
			if (days) add({ kind: "daily", time, uf, cityId });
		},
	);
}

/** A month's file, .csv or (older months) .zip; null if INPE has none. */
async function monthly(year: number, month: number, keep: boolean) {
	const name = `focos_mensal_br_${year}${String(month).padStart(2, "0")}`;
	const csv = await download(`${BASE}/mensal/Brasil/${name}.csv`, keep);
	if (csv) return csvText(csv, false);
	const zip = await download(`${BASE}/mensal/Brasil/${name}.zip`, keep);
	return zip ? csvText(zip, true) : null;
}

const part = (type: "year" | "month") =>
	Number(
		new Intl.DateTimeFormat("en", {
			[type]: "numeric",
			timeZone: "America/Sao_Paulo",
		}).format(now),
	);
const thisYear = part("year");
const thisMonth = part("month");
const isDone = (y: number, m: number) =>
	y < thisYear || (y === thisYear && m < thisMonth);

/** Months to read from the monthly files, oldest first. */
const months: { year: number; month: number; ref: boolean; days: boolean }[] =
	[];
if (backfill) {
	for (let year = FIRST_YEAR; year < thisYear; year++) {
		const zip = await download(
			`${BASE}/anual/Brasil_sat_ref/focos_br_ref_${year}.zip`,
			true,
		);
		if (zip) {
			addYearly(csvText(zip, true));
			console.log(`${year}: yearly reference file`);
		} else
			for (let m = 1; m <= 12; m++)
				months.push({ year, month: m, ref: true, days: false });
	}
	for (let y = FIRST_MONTHLY.year; y <= thisYear; y++)
		for (let m = 1; m <= 12; m++) {
			if (y === thisYear && m > thisMonth) break;
			const existing = months.find((x) => x.year === y && x.month === m);
			if (existing) existing.days = true;
			else months.push({ year: y, month: m, ref: y === thisYear, days: true });
		}
} else {
	// This month and last month: the reference satellite and every day.
	const last =
		thisMonth === 1
			? { y: thisYear - 1, m: 12 }
			: { y: thisYear, m: thisMonth - 1 };
	months.push({ year: last.y, month: last.m, ref: true, days: true });
	months.push({ year: thisYear, month: thisMonth, ref: true, days: true });
}

for (const { year, month, ref, days } of months) {
	const text = await monthly(year, month, isDone(year, month));
	if (!text) {
		console.warn(`${year}-${month}: no monthly file`);
		continue;
	}
	addCoded(text, { months: ref, days });
	console.log(`${year}-${String(month).padStart(2, "0")}: monthly file`);
}

// The freshest counts for the last 31 days come from the daily files.
for (let k = 31; k >= 0; k--) {
	const day = new Date(now.getTime() - k * 86_400_000);
	const ymd = day.toISOString().slice(0, 10).replaceAll("-", "");
	const csv = await download(
		`${BASE}/diario/Brasil/focos_diario_br_${ymd}.csv`,
		false,
	);
	if (csv) addCoded(csvText(csv, false), { days: true });
}
console.log("last 31 days: daily files");

// Write: set exactly the months and days processed, per region.
const db = await getDb();
const collection = db.collection<{ _id: string }>(HISTORY_COLLECTION);
const regions = aggregator.regions();
const updatedAt = new Date();
for (let i = 0; i < regions.length; i += 500) {
	await collection.bulkWrite(
		regions.slice(i, i + 500).map((r) => ({
			updateOne: {
				filter: { _id: r.id },
				update: {
					$set: {
						kind: r.kind,
						uf: r.uf,
						cityId: r.cityId,
						updatedAt,
						...Object.fromEntries(
							[...r.months].map(([k, n]) => [`months.${k}`, n]),
						),
						...Object.fromEntries(
							[...r.refDays].map(([k, n]) => [`refDays.${k}`, n]),
						),
						...Object.fromEntries(
							[...r.days].map(([k, n]) => [`days.${k}`, n]),
						),
					},
				},
				upsert: true,
			},
		})),
		{ ordered: false },
	);
}
// Year-to-date summaries need each region's whole series, so they're
// computed from what's now stored, for every region (rankings sort by them).
const summaries = [];
for await (const doc of collection.find({}, { projection: { refDays: 1 } })) {
	const refDays = (doc as { refDays?: Record<string, number> }).refDays ?? {};
	summaries.push({
		updateOne: {
			filter: { _id: doc._id },
			update: { $set: { ytd: ytdSummary(refDays, now) } },
		},
	});
}
for (let i = 0; i < summaries.length; i += 1000)
	await collection.bulkWrite(summaries.slice(i, i + 1000), { ordered: false });
await collection.createIndexes([
	{ key: { kind: 1, "ytd.current": -1 }, name: "kind_ytd_current" },
	{ key: { kind: 1, "ytd.ratio": -1 }, name: "kind_ytd_ratio" },
]);
console.log(`${summaries.length} year-to-date summaries`);
await closeDb();
console.log(
	`${stats.rows} rows (${stats.noState} without a state, ${stats.noCity} without a municipality);`,
	`${regions.length} regions written${backfill ? " (backfill)" : ""}`,
);
