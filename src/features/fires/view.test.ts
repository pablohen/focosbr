import { describe, expect, it } from "vitest";
import type { FiresResponse } from "./schemas";
import {
	boundsOf,
	describeFire,
	estimateFires,
	formatAgo,
	freshness,
	selectFires,
	summarize,
	toFeatures,
} from "./view";

const DATA: FiresResponse = {
	generatedAt: "2026-10-23T21:00:00.000Z",
	hours: 24,
	latestAt: "2026-10-23T20:00:00.000Z",
	sourceUpdatedAt: null,
	satellites: ["NOAA-20", "GOES-19"],
	states: ["PA", "MT"],
	places: ["Altamira (PA)", "Colniza (MT)"],
	biomes: ["Amazônia", ""],
	fires: {
		lon: [-52, -59, -53],
		lat: [-3, -9, -4],
		t: [
			Date.UTC(2026, 9, 23, 10) / 1000,
			Date.UTC(2026, 9, 23, 18) / 1000,
			Date.UTC(2026, 9, 23, 20) / 1000,
		],
		frp: [12.5, null, 3],
		sat: [0, 1, 0],
		state: [0, 1, 0],
		place: [0, 1, 0],
		biome: [0, 1, 0],
	},
};
const NOW = Date.UTC(2026, 9, 23, 21);

describe("selectFires", () => {
	it("keeps every detection without filters", () => {
		expect(selectFires(DATA, {})).toEqual([0, 1, 2]);
		expect(selectFires(DATA, { sensors: [] })).toEqual([0, 1, 2]);
	});
	it("filters by sensor family", () => {
		expect(selectFires(DATA, { sensors: ["goes"] })).toEqual([1]);
		expect(selectFires(DATA, { sensors: ["viirs", "goes"] })).toEqual([
			0, 1, 2,
		]);
	});
	it("filters by state and biome, combined with sensors", () => {
		expect(selectFires(DATA, { uf: "PA" })).toEqual([0, 2]);
		expect(selectFires(DATA, { biome: "Amazônia" })).toEqual([0, 2]);
		expect(selectFires(DATA, { uf: "PA", sensors: ["goes"] })).toEqual([]);
		expect(selectFires(DATA, { uf: "SP" })).toEqual([]);
		expect(selectFires(DATA, { place: "Colniza (MT)" })).toEqual([1]);
	});
});

describe("boundsOf", () => {
	it("wraps the detections, or is null without any", () => {
		expect(boundsOf(DATA, [0, 2])).toEqual([-53, -4, -52, -3]);
		expect(boundsOf(DATA, [])).toBeNull();
	});
});

describe("toFeatures", () => {
	it("builds points with age in hours and FRP defaulting to 0", () => {
		const fc = toFeatures(DATA, [0, 1], NOW);
		expect(fc.features[0]?.geometry.coordinates).toEqual([-52, -3]);
		expect(fc.features[0]?.properties).toEqual({ i: 0, age: 11, frp: 12.5 });
		expect(fc.features[1]?.properties.frp).toBe(0);
	});
});

describe("summarize", () => {
	it("ranks states and biomes and counts sensors", () => {
		const s = summarize(DATA, {});
		expect(s.total).toBe(3);
		expect(s.states).toEqual([
			{ name: "PA", count: 2 },
			{ name: "MT", count: 1 },
		]);
		expect(s.biomes[1]).toEqual({ name: "", count: 1 });
		expect(s.bySensor.get("viirs")).toBe(2);
	});
	it("leaves each breakdown's own filter out", () => {
		const s = summarize(DATA, { uf: "MT", sensors: ["goes"] });
		expect(s.total).toBe(1);
		// Every state, for the selected sensor.
		expect(s.states).toEqual([{ name: "MT", count: 1 }]);
		// Every sensor, for the selected state.
		expect(s.bySensor.get("goes")).toBe(1);
		expect(s.bySensor.has("viirs")).toBe(false);
		expect(summarize(DATA, { uf: "MT" }).states).toHaveLength(2);
		const byPlace = summarize(DATA, { place: "Colniza (MT)" });
		expect(byPlace.total).toBe(1);
		expect(byPlace.places.map((p) => p.name)).toEqual([
			"Altamira (PA)",
			"Colniza (MT)",
		]);
	});
});

describe("describeFire", () => {
	it("resolves lookup tables", () => {
		expect(describeFire(DATA, 1)).toEqual({
			place: "Colniza (MT)",
			biome: null,
			satellite: "GOES-19",
			time: new Date(Date.UTC(2026, 9, 23, 18)),
			frp: null,
		});
	});
});

describe("freshness", () => {
	it("measures INPE's lag and flags it past two hours", () => {
		const updated = "2026-10-23T21:06:00.000Z";
		expect(freshness(updated, Date.UTC(2026, 9, 23, 21, 56, 30))).toEqual({
			minutes: 50,
			stale: false,
		});
		expect(freshness(updated, Date.UTC(2026, 9, 23, 23, 7))?.stale).toBe(true);
		expect(freshness(null, NOW)).toBeNull();
	});
	it("formats the lag in Portuguese", () => {
		expect(formatAgo(0)).toBe("agora");
		expect(formatAgo(50)).toBe("há 50 min");
		expect(formatAgo(120)).toBe("há 2 h");
		expect(formatAgo(130)).toBe("há 2 h 10 min");
	});
});

describe("estimateFires", () => {
	/** Detections at [lon, lat, minutes after NOW-24h]. */
	const at = (...rows: [number, number, number][]): FiresResponse => ({
		...DATA,
		fires: {
			...DATA.fires,
			lon: rows.map((r) => r[0]),
			lat: rows.map((r) => r[1]),
			t: rows.map((r) => NOW / 1000 - 86_400 + r[2] * 60),
		},
	});
	const all = (d: FiresResponse) => d.fires.lon.map((_, i) => i);

	it("joins detections within 2 km and an hour", () => {
		// ~1.1 km apart, 30 min apart.
		const d = at([-50, -10, 0], [-50.01, -10, 30]);
		expect(estimateFires(d, all(d))).toBe(1);
	});
	it("keeps far or hours-apart detections separate", () => {
		const far = at([-50, -10, 0], [-50.05, -10, 0]); // ~5.5 km
		expect(estimateFires(far, all(far))).toBe(2);
		const later = at([-50, -10, 0], [-50, -10, 180]);
		expect(estimateFires(later, all(later))).toBe(2);
	});
	it("chains a fire that keeps burning", () => {
		const d = at([-50, -10, 0], [-50, -10, 50], [-50, -10, 100]);
		expect(estimateFires(d, all(d))).toBe(1);
	});
	it("only counts the given detections", () => {
		const d = at([-50, -10, 0], [-50.05, -10, 0], [-60, -5, 0]);
		expect(estimateFires(d, [0, 2])).toBe(2);
		expect(estimateFires(d, [])).toBe(0);
	});
});
