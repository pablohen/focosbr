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

/** Indices of the detections whose sensor is selected (all when none is). */
export function selectFires(
	data: FiresResponse,
	sensors: readonly Sensor[] | undefined,
): number[] {
	const allowed = sensors?.length ? new Set(sensors) : null;
	const satSensor = data.satellites.map(sensorOf);
	const out: number[] = [];
	data.fires.sat.forEach((s, i) => {
		const sensor = satSensor[s];
		if (!allowed || (sensor && allowed.has(sensor))) out.push(i);
	});
	return out;
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

export type Ranked = { name: string; count: number };

function rank(
	table: string[],
	column: number[],
	indices: number[],
	limit: number,
): Ranked[] {
	const counts = new Map<number, number>();
	for (const i of indices) {
		const k = column[i];
		if (k !== undefined) counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	return [...counts]
		.map(([k, count]) => ({ name: table[k] || "—", count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
		.slice(0, limit);
}

/**
 * Counts for the panel: total, per state and per biome for the selected
 * detections; per sensor for all of them, so the sensor chips keep their
 * counts while a filter is on.
 */
export function summarize(data: FiresResponse, indices: number[]) {
	const bySensor = new Map<Sensor, number>();
	const satSensor = data.satellites.map(sensorOf);
	for (const sat of data.fires.sat) {
		const s = satSensor[sat];
		if (s) bySensor.set(s, (bySensor.get(s) ?? 0) + 1);
	}
	return {
		total: indices.length,
		states: rank(data.states, data.fires.state, indices, 5),
		biomes: rank(data.biomes, data.fires.biome, indices, 6),
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
