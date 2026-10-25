/**
 * Fills the `forecast` collection the state and city pages read: INPE's
 * fire-risk forecast (rasters for the issue day and the next three, 1 km)
 * summarised per state, city and Brazil as the mean risk and the share of
 * the area at high or critical risk. Biomes have no outlines here, so they
 * get none.
 *
 * The issue day comes from the rasters' Last-Modified (INPE runs from 07:45
 * UTC and takes about three hours), and each day is labelled from it, so a
 * stale forecast is never shown as current. When INPE's files are missing
 * it warns and exits without failing, so the History job still passes.
 *
 * Usage: pnpm forecast:build   (needs MONGODB_URI; GitHub Actions runs it
 * daily after pnpm history:build)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { fromArrayBuffer } from "geotiff";
import { addDays, NO_DATA, summarizeRisk } from "../src/features/forecast/risk";
import {
	FORECAST_COLLECTION,
	type ForecastDay,
} from "../src/features/forecast/schemas";
import { BRAZIL_ID } from "../src/features/history/schemas";
import { closeDb, getDb } from "../src/lib/db.server";
import { gridPoints, polygonsOf } from "../src/lib/geometry";

const BASE =
	"https://dataserver-coids.inpe.br/queimadas/queimadas/riscofogo_meteorologia/previsto/risco_fogo";
const MESH =
	"https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio";
const CACHE = ".cache/forecast";
/** Brazil with a margin: [west, south, east, north]. */
const WINDOW = [-74.2, -33.9, -34.6, 5.4] as const;

mkdirSync(CACHE, { recursive: true });

/** The raster's Last-Modified, or null if INPE doesn't have it. */
async function lastModified(t: number): Promise<Date | null> {
	const res = await fetch(`${BASE}/RF.PREV.T${t}.tif`, { method: "HEAD" });
	const header = res.ok ? res.headers.get("last-modified") : null;
	return header ? new Date(header) : null;
}

/** The day of a moment in Brasília ("2026-10-23"). */
const brasiliaDay = (d: Date) =>
	new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

/** A sampler for one raster: `[lon, lat]` → risk, or NO_DATA outside it. */
async function sampler(t: number) {
	const res = await fetch(`${BASE}/RF.PREV.T${t}.tif`);
	if (!res.ok) throw new Error(`${res.status} RF.PREV.T${t}.tif`);
	const image = await (
		await fromArrayBuffer(await res.arrayBuffer())
	).getImage();
	const [originX = 0, originY = 0] = image.getOrigin();
	const [resX = 0.01, resY = -0.01] = image.getResolution();
	const [w, s, e, n] = WINDOW;
	const x0 = Math.floor((w - originX) / resX);
	const y0 = Math.floor((n - originY) / resY);
	const x1 = Math.ceil((e - originX) / resX);
	const y1 = Math.ceil((s - originY) / resY);
	const [band] = (await image.readRasters({
		window: [x0, y0, x1, y1],
	})) as unknown as [Float64Array];
	const width = x1 - x0;
	const height = y1 - y0;
	return (lon: number, lat: number) => {
		const col = Math.floor((lon - originX) / resX) - x0;
		const row = Math.floor((lat - originY) / resY) - y0;
		if (col < 0 || row < 0 || col >= width || row >= height) return NO_DATA;
		return band?.[row * width + col] ?? NO_DATA;
	};
}

const issuedAt = await lastModified(0);
if (!issuedAt) {
	console.warn("INPE's forecast rasters are unavailable; nothing to do.");
	process.exit(0);
}
const issued = brasiliaDay(issuedAt);

// Sampling points: states from our outlines, cities from IBGE's mesh.
type Shapes = FeatureCollection<Polygon | MultiPolygon, Record<string, string>>;
const outlines = JSON.parse(
	readFileSync("public/data/state-outlines.geojson", "utf8"),
) as Shapes;
const meshFile = `${CACHE}/mesh-br.json`;
if (!existsSync(meshFile)) {
	const res = await fetch(MESH);
	if (!res.ok) throw new Error(`${res.status} ${MESH}`);
	writeFileSync(meshFile, await res.text());
}
const mesh = JSON.parse(readFileSync(meshFile, "utf8")) as Shapes;

const regions: { id: string; points: [number, number][] }[] = [];
for (const f of outlines.features)
	regions.push({
		id: f.properties.uf ?? "",
		points: gridPoints(polygonsOf(f.geometry), 3000, 0.01),
	});
regions.push({ id: BRAZIL_ID, points: regions.flatMap((r) => r.points) });
for (const f of mesh.features)
	regions.push({
		id: f.properties.codarea ?? "",
		points: gridPoints(polygonsOf(f.geometry), 80, 0.01),
	});

const days = new Map<string, ForecastDay[]>(regions.map((r) => [r.id, []]));
for (let t = 0; t <= 3; t++) {
	const date = addDays(issued, t);
	let sample: Awaited<ReturnType<typeof sampler>>;
	try {
		sample = await sampler(t);
	} catch (err) {
		console.warn(`day ${t} (${date}) unavailable:`, String(err));
		continue;
	}
	for (const r of regions) {
		const summary = summarizeRisk(r.points.map(([x, y]) => sample(x, y)));
		if (summary) days.get(r.id)?.push({ date, ...summary });
	}
	console.log(`${date}: sampled ${regions.length} regions`);
}

const db = await getDb();
const collection = db.collection<{ _id: string }>(FORECAST_COLLECTION);
const updatedAt = new Date();
const writes = regions.map((r) => ({
	replaceOne: {
		filter: { _id: r.id },
		replacement: { issued, days: days.get(r.id) ?? [], updatedAt },
		upsert: true,
	},
}));
for (let i = 0; i < writes.length; i += 1000)
	await collection.bulkWrite(writes.slice(i, i + 1000), { ordered: false });
await closeDb();
console.log(`forecast issued ${issued}: ${regions.length} regions written`);
