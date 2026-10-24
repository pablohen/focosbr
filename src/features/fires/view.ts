/**
 * Client-side shaping of `/api/fires` responses: map features and the
 * panel's counts. Pure, so it can be tested without MapLibre.
 */
import type { FeatureCollection, Point } from "geojson";
import { sensorOf } from "./inpe";
import type { FiresResponse, Sensor } from "./schemas";
import { STATE_NAMES } from "./states";

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

/** Nominal pixel size at the sub-satellite point; larger off-nadir. */
export const SENSOR_RESOLUTION: Record<Sensor, string | null> = {
	viirs: "375 m",
	modis: "1 km",
	goes: "2 km",
	metop: "1 km",
	msg: "3 km",
	other: null,
};

/** INPE's fire-risk classes, by their published thresholds. */
export function riskClass(risk: number): string {
	if (risk < 0.15) return "Mínimo";
	if (risk < 0.4) return "Baixo";
	if (risk < 0.7) return "Médio";
	if (risk < 0.95) return "Alto";
	return "Crítico";
}

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
	/** "Município (UF)" label, as in `FiresResponse.places`. */
	place?: string;
	/** Timeline position: only detections up to this time (Unix seconds). */
	until?: number;
};

/** Indices of the detections that pass every filter. */
export function selectFires(
	data: FiresResponse,
	{ sensors, uf, biome, place, until }: FireFilters,
): number[] {
	const allowed = sensors?.length ? new Set(sensors) : null;
	const satOk = data.satellites.map(
		(s) => !allowed || allowed.has(sensorOf(s)),
	);
	const stateOk = data.states.map((s) => !uf || s === uf);
	const biomeOk = data.biomes.map((b) => !biome || b === biome);
	const placeOk = data.places.map((p) => !place || p === place);
	const f = data.fires;
	const out: number[] = [];
	for (let i = 0; i < f.sat.length; i++)
		if (
			satOk[f.sat[i] ?? -1] &&
			stateOk[f.state[i] ?? -1] &&
			biomeOk[f.biome[i] ?? -1] &&
			placeOk[f.place[i] ?? -1] &&
			(until === undefined || (f.t[i] ?? 0) <= until)
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
 * Estimated fires: `groupOf` maps each detection (index into `fires`) to
 * its fire's id, and `members` lists each fire's detections.
 */
export type FireGroups = {
	groupOf: Map<number, number>;
	members: Map<number, number[]>;
};

/**
 * Groups the detections into estimated distinct fires. Several
 * satellites see the same fire minutes apart, and GOES sees it every 10
 * minutes, so raw counts inflate. Detections within MERGE_KM and
 * MERGE_SECONDS of each other are joined (transitively, so a front that
 * keeps burning stays one fire).
 */
export function fireGroups(data: FiresResponse, indices: number[]): FireGroups {
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
	const groupOf = new Map<number, number>();
	const members = new Map<number, number[]>();
	indices.forEach((i, k) => {
		const root = indices[find(k)] ?? i;
		groupOf.set(i, root);
		const list = members.get(root);
		if (list) list.push(i);
		else members.set(root, [i]);
	});
	return { groupOf, members };
}

/** Estimated number of distinct fires among the detections. */
export function estimateFires(data: FiresResponse, indices: number[]): number {
	return fireGroups(data, indices).members.size;
}

/** The fire a detection belongs to, for its popup. */
export function describeGroup(
	data: FiresResponse,
	groups: FireGroups,
	i: number,
) {
	const root = groups.groupOf.get(i);
	const members = root === undefined ? [i] : (groups.members.get(root) ?? [i]);
	const times = members.map((m) => data.fires.t[m] ?? 0);
	const satellites = [
		...new Set(
			members.map((m) => data.satellites[data.fires.sat[m] ?? -1] ?? ""),
		),
	]
		.filter(Boolean)
		.sort();
	return {
		count: members.length,
		first: new Date(Math.min(...times) * 1000),
		last: new Date(Math.max(...times) * 1000),
		satellites,
	};
}

export type TopFire = {
	/** The fire's id in `FireGroups.members`. */
	id: number;
	/** The detection to show: the fire's newest. */
	focus: number;
	count: number;
	/** Sum of the detections' FRP, MW; null when no sensor reported it. */
	totalFrp: number | null;
	first: Date;
	last: Date;
	/** Most common municipality, else the state, else "Local desconhecido". */
	place: string;
	bounds: [number, number, number, number];
};

/**
 * How "biggest" is measured: `count` favours wide or long-lasting fires
 * (many pixels, or GOES seeing it every 10 minutes); `frp` favours intense
 * ones. Neither is the fire's size, so the UI offers both.
 */
export type TopFireOrder = "count" | "frp";

/** The biggest fires by `by`, ties broken by the other measure. */
export function topFires(
	data: FiresResponse,
	groups: FireGroups,
	by: TopFireOrder = "count",
	limit = 10,
): TopFire[] {
	const f = data.fires;
	const fires: TopFire[] = [];
	for (const [id, members] of groups.members) {
		let focus = members[0] ?? id;
		let frp: number | null = null;
		const places = new Map<string, number>();
		for (const m of members) {
			if ((f.t[m] ?? 0) > (f.t[focus] ?? 0)) focus = m;
			const p = f.frp[m];
			if (p != null) frp = (frp ?? 0) + p;
			const place = data.places[f.place[m] ?? -1];
			if (place) places.set(place, (places.get(place) ?? 0) + 1);
		}
		const times = members.map((m) => f.t[m] ?? 0);
		const state = data.states[f.state[focus] ?? -1];
		fires.push({
			id,
			focus,
			count: members.length,
			totalFrp: frp,
			first: new Date(Math.min(...times) * 1000),
			last: new Date(Math.max(...times) * 1000),
			place:
				[...places].sort((a, b) => b[1] - a[1])[0]?.[0] ??
				(state
					? `${STATE_NAMES[state] ?? state} (${state})`
					: "Local desconhecido"),
			bounds: boundsOf(data, members) ?? [0, 0, 0, 0],
		});
	}
	const frp = (x: TopFire) => x.totalFrp ?? 0;
	return fires
		.sort((a, b) =>
			by === "count"
				? b.count - a.count || frp(b) - frp(a)
				: frp(b) - frp(a) || b.count - a.count,
		)
		.slice(0, limit);
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
	const groups = fireGroups(data, selected);
	return {
		total: selected.length,
		preliminary: selected.filter((i) => data.fires.prelim[i] === 1).length,
		fires: groups.members.size,
		/** The selected detections grouped into fires, for popups. */
		groups,
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
		places: rank(
			data.places,
			data.fires.place,
			selectFires(data, { ...filters, place: undefined }),
		),
		bySensor,
	};
}
/** The detection's details for its popup. */
export function describeFire(data: FiresResponse, i: number) {
	const f = data.fires;
	const state = data.states[f.state[i] ?? -1] ?? "";
	const preliminary = f.prelim[i] === 1;
	return {
		// Preliminary detections only know their state (located by us).
		place:
			data.places[f.place[i] ?? -1] ||
			(state
				? `${STATE_NAMES[state] ?? state} (${state})`
				: "Local desconhecido"),
		preliminary,
		biome: data.biomes[f.biome[i] ?? -1] || null,
		satellite: data.satellites[f.sat[i] ?? -1] ?? "",
		sensor: sensorOf(data.satellites[f.sat[i] ?? -1] ?? ""),
		time: new Date((f.t[i] ?? 0) * 1000),
		frp: f.frp[i] ?? null,
		lon: f.lon[i] ?? 0,
		lat: f.lat[i] ?? 0,
		// Missing in payloads from before these fields existed.
		dryDays: f.dry[i] ?? null,
		rain: f.rain[i] ?? null,
		risk: f.risk[i] ?? null,
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

export type HourBucket = { start: number; count: number };

/**
 * Detections per clock hour over the window, oldest first. The last bucket
 * is the hour `nowMs` falls in, so the bar for "now" is still filling.
 */
export function hourlyCounts(
	data: FiresResponse,
	indices: number[],
	hours: number,
	nowMs: number,
): HourBucket[] {
	const hour = 3_600_000;
	const first = Math.floor(nowMs / hour) * hour - (hours - 1) * hour;
	const buckets = Array.from({ length: hours }, (_, k) => ({
		start: first + k * hour,
		count: 0,
	}));
	for (const i of indices) {
		const k = Math.floor(((data.fires.t[i] ?? 0) * 1000 - first) / hour);
		const bucket = buckets[k];
		if (bucket) bucket.count++;
	}
	return buckets;
}
