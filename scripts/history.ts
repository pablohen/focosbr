/**
 * Fills the `history` collection the state and city pages read (see
 * src/features/history): detections per month since 2003 from INPE's
 * reference satellite, and per day from all satellites, for Brazil, each
 * state, each municipality and each biome.
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
 * safe, then refreshes every region's year-to-date summary (`ytd`) and
 * stores new alerts (see src/features/history/alerts.ts). Completed years and months are cached in .cache/history.
 *
 * Usage: pnpm history:build [--backfill]   (needs MONGODB_URI)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { parseGmt, UF_BY_IBGE } from "../src/features/fires/inpe";
import { STATE_NAMES } from "../src/features/fires/states";
import {
	ALERTS_COLLECTION,
	type Alert,
	type AlertDraft,
	regionAlerts,
} from "../src/features/history/alerts";
import {
	createHistoryAggregator,
	type HistoryDetection,
	lastWeek,
	RENAMED,
	weekStats,
	yearTotals,
	ytdSummary,
} from "../src/features/history/build";
import {
	BRAZIL_ID,
	FIRST_YEAR,
	HISTORY_COLLECTION,
	REFERENCE_SATELLITE,
	SUMMARIES_COLLECTION,
	SUMMARY_CITIES,
	type WeekRow,
	type YearRow,
} from "../src/features/history/schemas";
import { biomeBySlug, biomePath } from "../src/features/places/biomes";
import list from "../src/features/places/municipalities.json";
import {
	MunicipalityListSchema,
	municipalityIndex,
	municipalityPath,
	placeLabel,
	slugify,
	statePath,
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

/** A history id's name and page, for alerts. */
/** A history id's region key, name and page, for alerts and summaries. */
function describe(
	id: string,
): { key: string; name: string; path: string } | null {
	if (id === BRAZIL_ID) return { key: "br", name: "Brasil", path: "/" };
	if (id.startsWith("biome/")) {
		const b = biomeBySlug(id.slice(6));
		return b ? { key: id, name: b.name, path: biomePath(b.slug) } : null;
	}
	const state = STATE_NAMES[id];
	if (state) return { key: id.toLowerCase(), name: state, path: statePath(id) };
	const m = municipalities.byId.get(Number(id));
	return m
		? {
				key: `${m.uf.toLowerCase()}/${slugify(m.name)}`,
				name: placeLabel(m.name, m.uf),
				path: municipalityPath(m.uf, m.name),
			}
		: null;
}

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
	eachRow(text, ["data_pas", "estado", "municipio", "bioma"], (get) => {
		const uf = ufByStateName.get(slugify(get("estado")));
		const time = parseGmt(get("data_pas"));
		if (!uf || Number.isNaN(time)) return add(null);
		const slug = slugify(get("municipio"));
		const renamed = RENAMED[`${uf}/${slug}`];
		const city = municipalities.find(uf, renamed ? slugify(renamed) : slug);
		add({
			kind: "reference",
			time,
			uf,
			cityId: city?.id,
			biome: get("bioma"),
		});
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
		["data_hora_gmt", "satelite", "estado_id", "municipio_id", "bioma"],
		(get) => {
			const uf = UF_BY_IBGE[get("estado_id")];
			const time = parseGmt(get("data_hora_gmt"));
			if (!uf || Number.isNaN(time)) return add(null);
			const id = Number(get("municipio_id"));
			const cityId = municipalities.byId.has(id) ? id : undefined;
			const biome = get("bioma");
			if (months && get("satelite") === REFERENCE_SATELLITE)
				aggregator.add({ kind: "reference", time, uf, cityId, biome });
			if (days) add({ kind: "daily", time, uf, cityId, biome });
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
const alerts: AlertDraft[] = [];
// The weekly and yearly pages, precomputed from every region's series.
const week = lastWeek(now);
const weekRows: WeekRow[] = [];
const weekCities: WeekRow[] = [];
const yearRows = new Map<
	number,
	{ states: YearRow[]; biomes: YearRow[]; cities: YearRow[] }
>();
let brazilMonths: Record<string, number> = {};
for await (const doc of collection.find(
	{},
	{ projection: { refDays: 1, days: 1, months: 1, kind: 1 } },
)) {
	const {
		refDays = {},
		days = {},
		months = {},
		kind,
	} = doc as {
		refDays?: Record<string, number>;
		days?: Record<string, number>;
		months?: Record<string, number>;
		kind?: Alert["kind"];
	};
	const ytd = ytdSummary(refDays, now);
	summaries.push({
		updateOne: {
			filter: { _id: doc._id },
			update: { $set: { ytd } },
		},
	});
	if (!kind) continue;
	alerts.push(...regionAlerts({ id: doc._id, kind }, refDays, ytd));
	const where = describe(doc._id);
	if (!where) continue;
	const row = { ...where, kind, ...weekStats(days, refDays, week) };
	(kind === "city" ? weekCities : weekRows).push(row);
	if (kind === "country") brazilMonths = months;
	else
		for (const [y, count] of yearTotals(months)) {
			const rows = yearRows.get(y) ?? { states: [], biomes: [], cities: [] };
			rows[
				kind === "state" ? "states" : kind === "biome" ? "biomes" : "cities"
			].push({ ...where, kind, count });
			yearRows.set(y, rows);
		}
}
for (let i = 0; i < summaries.length; i += 1000)
	await collection.bulkWrite(summaries.slice(i, i + 1000), { ordered: false });
await collection.createIndexes([
	{ key: { kind: 1, "ytd.current": -1 }, name: "kind_ytd_current" },
	{ key: { kind: 1, "ytd.ratio": -1 }, name: "kind_ytd_ratio" },
]);
console.log(`${summaries.length} year-to-date summaries`);

// Summaries: the week, and every year since FIRST_YEAR.
const summariesCollection = db.collection<{ _id: string }>(
	SUMMARIES_COLLECTION,
);
const byKindOrder = { country: 0, state: 1, biome: 2, city: 3 } as const;
weekRows.sort(
	(a, b) => byKindOrder[a.kind] - byKindOrder[b.kind] || b.current - a.current,
);
await summariesCollection.replaceOne(
	{ _id: "week" },
	{
		from: week[0],
		through: week.at(-1),
		updatedAt,
		regions: weekRows,
		topCities: [...weekCities]
			.sort((a, b) => b.current - a.current)
			.slice(0, SUMMARY_CITIES),
		risingCities: weekCities
			.filter((c) => c.current >= 20 && c.current > c.previous)
			.sort((a, b) => b.current - b.previous - (a.current - a.previous))
			.slice(0, SUMMARY_CITIES),
	},
	{ upsert: true },
);
const through = lastWeek(now).at(-1) ?? "";
const totals = [...yearTotals(brazilMonths)]
	.map(([year, count]) => ({ year, count }))
	.sort((a, b) => a.year - b.year);
const byCount = (a: YearRow, b: YearRow) => b.count - a.count;
for (let year = FIRST_YEAR; year <= thisYear; year++) {
	const rows = yearRows.get(year) ?? { states: [], biomes: [], cities: [] };
	await summariesCollection.replaceOne(
		{ _id: `year/${year}` },
		{
			year,
			partial: year === thisYear,
			through,
			updatedAt,
			totals,
			months: Array.from(
				{ length: 12 },
				(_, m) =>
					brazilMonths[`${year}-${String(m + 1).padStart(2, "0")}`] ?? 0,
			),
			states: rows.states.sort(byCount),
			biomes: rows.biomes.sort(byCount),
			cities: rows.cities.sort(byCount).slice(0, SUMMARY_CITIES),
		},
		{ upsert: true },
	);
}
console.log(
	`week ${week[0]}…${week.at(-1)} and ${thisYear - FIRST_YEAR + 1} years summarised`,
);

// Alerts: inserted once (the id carries the region and day or year), so
// a re-run keeps each alert's first date.
const alertsCollection = db.collection<{ _id: string }>(ALERTS_COLLECTION);
const described = alerts.flatMap((a) => {
	const where = describe(a.regionId);
	return where ? [{ ...a, ...where, createdAt: updatedAt }] : [];
});
if (described.length) {
	const result = await alertsCollection.bulkWrite(
		described.map((a) => ({
			updateOne: {
				filter: { _id: a._id },
				update: { $setOnInsert: a },
				upsert: true,
			},
		})),
		{ ordered: false },
	);
	console.log(`${result.upsertedCount} new alerts`);
}
// An alert's name and page follow the region, not the day it was written,
// so pages that move or get renamed keep every stored alert's link working.
const stored = await alertsCollection
	.find<Pick<Alert, "_id" | "regionId" | "name" | "path">>(
		{},
		{ projection: { regionId: 1, name: 1, path: 1 } },
	)
	.toArray();
const relinked = stored.flatMap((a) => {
	const where = describe(a.regionId);
	return where && (where.name !== a.name || where.path !== a.path)
		? [
				{
					updateOne: {
						filter: { _id: a._id },
						update: { $set: { name: where.name, path: where.path } },
					},
				},
			]
		: [];
});
if (relinked.length) {
	await alertsCollection.bulkWrite(relinked, { ordered: false });
	console.log(`${relinked.length} alerts relinked`);
}
await alertsCollection.createIndex({ createdAt: -1 }, { name: "createdAt" });
await closeDb();
console.log(
	`${stats.rows} rows (${stats.noState} without a state, ${stats.noCity} without a municipality);`,
	`${regions.length} regions written${backfill ? " (backfill)" : ""}`,
);
