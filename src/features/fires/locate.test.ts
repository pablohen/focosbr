import { readFileSync } from "node:fs";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { describe, expect, it } from "vitest";
import { createStateLocator } from "./locate";

/** Two squares; "AA" has a hole in the middle. */
const FIXTURE: FeatureCollection<MultiPolygon, { uf: string }> = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			properties: { uf: "AA" },
			geometry: {
				type: "MultiPolygon",
				coordinates: [
					[
						[
							[0, 0],
							[10, 0],
							[10, 10],
							[0, 10],
							[0, 0],
						],
						[
							[4, 4],
							[6, 4],
							[6, 6],
							[4, 6],
							[4, 4],
						],
					],
				],
			},
		},
		{
			type: "Feature",
			properties: { uf: "BB" },
			geometry: {
				type: "MultiPolygon",
				coordinates: [
					[
						[
							[10, 0],
							[20, 0],
							[20, 10],
							[10, 10],
							[10, 0],
						],
					],
				],
			},
		},
	],
};

describe("createStateLocator", () => {
	const locate = createStateLocator(FIXTURE);

	it("finds the state a point falls in", () => {
		expect(locate(2, 2)).toBe("AA");
		expect(locate(15, 5)).toBe("BB");
	});
	it("returns null outside every state and inside holes", () => {
		expect(locate(-5, 5)).toBeNull();
		expect(locate(5, 5)).toBeNull();
	});

	it("places real points with the IBGE outlines", () => {
		const outlines = JSON.parse(
			readFileSync("public/data/state-outlines.geojson", "utf8"),
		);
		const real = createStateLocator(outlines);
		expect(real(-52.21, -3.2)).toBe("PA"); // Altamira
		expect(real(-56.1, -15.6)).toBe("MT"); // Cuiabá
		expect(real(-47.88, -15.79)).toBe("DF"); // Brasília
		expect(real(-62.84, 9.08)).toBeNull(); // Venezuela
		expect(real(-30, -10)).toBeNull(); // Atlantic
	});
});
