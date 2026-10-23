/**
 * Client-side shaping of `/api/fires` responses: map features and the
 * panel's counts. Pure, so it can be tested without MapLibre.
 */
import type { FeatureCollection, Point } from "geojson";
import { sensorOf } from "./inpe";
import type { FiresResponse, Sensor } from "./schemas";

/**
 * Age bands, newest first: one red hue, darker = more recent (an ordinal
 * ramp validated against the light basemap).
 */
export const AGE_BANDS = [
	{ maxHours: 3, color: "#8f1d0e", label: "menos de 3 h" },
	{ maxHours: 12, color: "#d9431e", label: "3 a 12 h" },
	{
		maxHours: Number.POSITIVE_INFINITY,
		color: "#f28c5c",
		label: "mais de 12 h",
	},
] as const;

export const SENSOR_LABELS: Record<Sensor, string> = {
	viirs: "VIIRS",
	modis: "MODIS",
	goes: "GOES",
	metop: "METOP",
	msg: "MSG",
	other: "Outros",
};

export type FireProps = { i: number; age: number; frp: number };

/** What the map and counts are narrowed to; an empty field matches all. */
export type FireFilters = {
	sensors?: readonly Sensor[];
	/** Two-letter state code. */
	uf?: string;
	biome?: string;
};

/** Indices of the detections that pass every filter. */
export function selectFires(
	data: FiresResponse,
	{ sensors, uf, biome }: FireFilters,
): number[] {
	const allowed = sensors?.length ? new Set(sensors) : null;
	const satOk = data.satellites.map(
		(s) => !allowed || allowed.has(sensorOf(s)),
	);
	const stateOk = data.states.map((s) => !uf || s === uf);
	const biomeOk = data.biomes.map((b) => !biome || b === biome);
	const f = data.fires;
	const out: number[] = [];
	for (let i = 0; i < f.sat.length; i++)
		if (
			satOk[f.sat[i] ?? -1] &&
			stateOk[f.state[i] ?? -1] &&
			biomeOk[f.biome[i] ?? -1]
		)
			out.push(i);
	return out;
}

/** [west, south, east, north] around the given detections, or null if none. */
export function boundsOf(
	data: FiresResponse,
	indices: number[],
): [number, number, number, number] | null {
	if (indices.length === 0) return null;
	let [w, s, e, n] = [180, 90, -180, -90];
	for (const i of indices) {
		const lon = data.fires.lon[i] ?? 0;
		const lat = data.fires.lat[i] ?? 0;
		w = Math.min(w, lon);
		e = Math.max(e, lon);
		s = Math.min(s, lat);
		n = Math.max(n, lat);
	}
	return [w, s, e, n];
}

/** Detections this close in space and time are taken as the same fire. */
export const MERGE_KM = 2;
export const MERGE_SECONDS = 3600;
/** Grid cell in degrees: at least MERGE_KM wide anywhere in Brazil. */
const CELL_DEG = 0.02;

/**
 * Estimated number of distinct fires among the detections. Several
 * satellites see the same fire minutes apart, and GOES sees it every 10
 * minutes, so raw counts inflate. Detections within MERGE_KM and
 * MERGE_SECONDS of each other are joined (transitively, so a front that
 * keeps burning stays one fire).
 */
export function estimateFires(data: FiresResponse, indices: number[]): number {
	const { lon, lat, t } = data.fires;
	const parent = indices.map((_, k) => k);
	const find = (k: number): number => {
		let r = k;
		while (parent[r] !== r) {
			parent[r] = parent[parent[r] ?? r] ?? r;
			r = parent[r] ?? r;
		}
		return r;
	};
	const grid = new Map<string, number[]>();
	indices.forEach((i, k) => {
		const x = Math.floor((lon[i] ?? 0) / CELL_DEG);
		const y = Math.floor((lat[i] ?? 0) / CELL_DEG);
		const kmPerLon = 111.32 * Math.cos(((lat[i] ?? 0) * Math.PI) / 180);
		for (let dx = -1; dx <= 1; dx++)
			for (let dy = -1; dy <= 1; dy++)
				for (const j of grid.get(`${x + dx}:${y + dy}`) ?? []) {
					const o = indices[j] ?? 0;
					if (Math.abs((t[i] ?? 0) - (t[o] ?? 0)) > MERGE_SECONDS) continue;
					const ex = ((lon[i] ?? 0) - (lon[o] ?? 0)) * kmPerLon;
					const ey = ((lat[i] ?? 0) - (lat[o] ?? 0)) * 110.57;
					if (ex * ex + ey * ey > MERGE_KM * MERGE_KM) continue;
					const a = find(k);
					const b = find(j);
					if (a !== b) parent[a] = b;
				}
		const key = `${x}:${y}`;
		const cell = grid.get(key);
		if (cell) cell.push(k);
		else grid.set(key, [k]);
	});
	let roots = 0;
	for (let k = 0; k < parent.length; k++) if (find(k) === k) roots++;
	return roots;
}

/** Points for MapLibre, with age in hours relative to `nowMs`. */
export function toFeatures(
	data: FiresResponse,
	indices: number[],
	nowMs: number,
): FeatureCollection<Point, FireProps> {
	const { lon, lat, t, frp } = data.fires;
	return {
		type: "FeatureCollection",
		features: indices.map((i) => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: [lon[i] ?? 0, lat[i] ?? 0] },
			properties: {
				i,
				age: Math.max(0, (nowMs / 1000 - (t[i] ?? 0)) / 3600),
				frp: frp[i] ?? 0,
			},
		})),
	};
}

/** `name` is as published: an empty string when INPE has no value. */
export type Ranked = { name: string; count: number };

function rank(table: string[], column: number[], indices: number[]): Ranked[] {
	const counts = new Map<number, number>();
	for (const i of indices) {
		const k = column[i];
		if (k !== undefined) counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	return [...counts]
		.map(([k, count]) => ({ name: table[k] ?? "", count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Counts for the panel. Each breakdown ignores its own filter, so every
 * state stays listed (with its count) while one is selected, and the same
 * for biomes and sensors.
 */
export function summarize(data: FiresResponse, filters: FireFilters) {
	const bySensor = new Map<Sensor, number>();
	const satSensor = data.satellites.map(sensorOf);
	for (const i of selectFires(data, { ...filters, sensors: undefined })) {
		const s = satSensor[data.fires.sat[i] ?? -1];
		if (s) bySensor.set(s, (bySensor.get(s) ?? 0) + 1);
	}
	const selected = selectFires(data, filters);
	return {
		total: selected.length,
		fires: estimateFires(data, selected),
		states: rank(
			data.states,
			data.fires.state,
			selectFires(data, { ...filters, uf: undefined }),
		),
		biomes: rank(
			data.biomes,
			data.fires.biome,
			selectFires(data, { ...filters, biome: undefined }),
		),
		bySensor,
	};
}
/** The detection's details for its popup. */
export function describeFire(data: FiresResponse, i: number) {
	const f = data.fires;
	return {
		place: data.places[f.place[i] ?? -1] || "Local desconhecido",
		biome: data.biomes[f.biome[i] ?? -1] || null,
		satellite: data.satellites[f.sat[i] ?? -1] ?? "",
		time: new Date((f.t[i] ?? 0) * 1000),
		frp: f.frp[i] ?? null,
	};
}

/** Past this, INPE's feed counts as late (it usually lags an hour or less). */
export const STALE_AFTER_MINUTES = 120;

/** How old INPE's data is at `nowMs`, or null when it didn't say. */
export function freshness(sourceUpdatedAt: string | null, nowMs: number) {
	if (!sourceUpdatedAt) return null;
	const minutes = Math.max(
		0,
		Math.floor((nowMs - Date.parse(sourceUpdatedAt)) / 60_000),
	);
	return { minutes, stale: minutes > STALE_AFTER_MINUTES };
}

/** "agora", "há 5 min", "há 2 h 10 min". */
export function formatAgo(minutes: number): string {
	if (minutes < 1) return "agora";
	if (minutes < 60) return `há ${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `há ${h} h ${m} min` : `há ${h} h`;
}
