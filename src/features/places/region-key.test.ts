import { describe, expect, it } from "vitest";
import { parseRegionKey, regionKey } from "./region-key";

describe("parseRegionKey", () => {
	it("reads Brazil, states, cities and biomes", () => {
		expect(parseRegionKey("br")).toEqual({ kind: "country" });
		expect(parseRegionKey("PA")).toEqual({ kind: "state", uf: "PA" });
		expect(parseRegionKey("pa/altamira")).toEqual({
			kind: "city",
			uf: "PA",
			slug: "altamira",
		});
		expect(parseRegionKey("biome/mata-atlantica")).toEqual({
			kind: "biome",
			slug: "mata-atlantica",
		});
	});

	it("rejects unknown states and biomes and bad shapes", () => {
		for (const key of ["xx", "biome/oceano", "biome", "pa/a/b", "pa/Ação", ""])
			expect(parseRegionKey(key)).toBeNull();
	});

	it("round-trips through regionKey", () => {
		for (const key of ["br", "pa", "pa/altamira", "biome/pampa"])
			expect(regionKey(parseRegionKey(key) ?? { kind: "country" })).toBe(key);
	});
});
