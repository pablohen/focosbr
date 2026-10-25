import { describe, expect, it } from "vitest";
import type { Ytd } from "../history/schemas";
import { cityCircles, MAX_CIRCLES, MAX_RADIUS } from "./city-circles";

const ytd = (current: number, ratio: number | null): Ytd => ({
	through: "2026-10-23",
	current,
	average: 100,
	ratio,
	record: null,
	years: [],
});

describe("cityCircles", () => {
	const cities = [
		{ id: 1, name: "A", slug: "a" },
		{ id: 2, name: "B", slug: "b" },
		{ id: 3, name: "C", slug: "c" },
		{ id: 4, name: "D", slug: "d" },
	];
	const ytds = new Map([
		[1, ytd(400, 3)],
		[2, ytd(100, 0.4)],
		[3, ytd(0, 0)],
	]);
	const circles = cityCircles(
		cities,
		ytds,
		(id) => (id === 2 ? [1, 2] : [0, 0]),
		(lon, lat) => [lon * 10, lat * 10],
	);

	it("draws cities with detections this year, biggest first", () => {
		expect(circles.map((c) => c.name)).toEqual(["A", "B"]);
	});

	it("keeps only the cities with most detections", () => {
		const many = Array.from({ length: MAX_CIRCLES + 10 }, (_, i) => ({
			id: i,
			name: String(i),
			slug: String(i),
		}));
		const all = new Map(many.map((c) => [c.id, ytd(c.id + 1, 1)]));
		const kept = cityCircles(
			many,
			all,
			() => [0, 0],
			(x, y) => [x, y],
		);
		expect(kept).toHaveLength(MAX_CIRCLES);
		expect(kept.at(-1)?.current).toBe(11);
	});

	it("scales area with the count and colours by the ratio", () => {
		expect(circles[0]).toMatchObject({ r: MAX_RADIUS, step: 2 });
		expect(circles[1]).toMatchObject({
			x: 10,
			y: 20,
			r: MAX_RADIUS / 2,
			step: -2,
		});
	});
});
