import { describe, expect, it } from "vitest";
import { centroidOf, gridPoints, inPolygons } from "./geometry";

// A 2×2 square with a 1×1 notch cut from its top-right corner (an L).
const L = [
	[
		[0, 0],
		[2, 0],
		[2, 1],
		[1, 1],
		[1, 2],
		[0, 2],
		[0, 0],
	],
];

describe("geometry", () => {
	it("finds the centroid of a shape", () => {
		const [x, y] = centroidOf([L]);
		expect(x).toBeCloseTo(5 / 6);
		expect(y).toBeCloseTo(5 / 6);
	});

	it("samples a grid inside the shape only", () => {
		const points = gridPoints([L], 100);
		expect(points.length).toBeGreaterThan(50);
		expect(points.every(([x, y]) => inPolygons(x, y, [L]))).toBe(true);
		expect(points.some(([x, y]) => x > 1 && y > 1)).toBe(false);
	});

	it("falls back to the centroid for a shape smaller than one step", () => {
		expect(gridPoints([L], 100, 5)).toHaveLength(1);
	});
});
