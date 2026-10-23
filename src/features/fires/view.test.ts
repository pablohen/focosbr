import { describe, expect, it } from "vitest";
import type { FiresResponse } from "./schemas";
import { describeFire, selectFires, summarize, toFeatures } from "./view";

const DATA: FiresResponse = {
	generatedAt: "2026-10-23T21:00:00.000Z",
	hours: 24,
	latestAt: "2026-10-23T20:00:00.000Z",
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
	it("keeps every detection without a sensor filter", () => {
		expect(selectFires(DATA, undefined)).toEqual([0, 1, 2]);
		expect(selectFires(DATA, [])).toEqual([0, 1, 2]);
	});
	it("filters by sensor family", () => {
		expect(selectFires(DATA, ["goes"])).toEqual([1]);
		expect(selectFires(DATA, ["viirs", "goes"])).toEqual([0, 1, 2]);
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
		const s = summarize(DATA, [0, 1, 2]);
		expect(s.total).toBe(3);
		expect(s.states).toEqual([
			{ name: "PA", count: 2 },
			{ name: "MT", count: 1 },
		]);
		expect(s.biomes[1]).toEqual({ name: "—", count: 1 });
		expect(s.bySensor.get("viirs")).toBe(2);
	});
	it("counts every sensor even when filtered", () => {
		const s = summarize(DATA, [1]);
		expect(s.total).toBe(1);
		expect(s.bySensor.get("viirs")).toBe(2);
		expect(s.bySensor.get("goes")).toBe(1);
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
