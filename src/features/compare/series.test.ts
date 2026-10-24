import { describe, expect, it } from "vitest";
import { compareLines } from "./series";

const season = (average: number[], current: number[]) => ({
	through: "2026-01-14",
	days: [7, 14],
	min: [0, 0],
	max: [0, 0],
	average,
	record: null,
	current: {
		year: 2026,
		points: current.map((count, k) => ({ day: (k + 1) * 7, count })),
	},
});

describe("compareLines", () => {
	const places = [
		null,
		{ name: "Pará", season: season([50, 200], [30, 100]) },
		{ name: "Nowhere", season: season([0, 0], [0, 0]) },
	];

	it("keeps each place's slot and counts by default", () => {
		const lines = compareLines(places, "count");
		expect(lines.map((l) => [l.slot, l.name])).toEqual([
			[1, "Pará"],
			[2, "Nowhere"],
		]);
		expect(lines[0]?.current).toEqual([
			{ day: 7, value: 30 },
			{ day: 14, value: 100 },
		]);
	});

	it("indexes to the average year's total, dropping places without one", () => {
		const lines = compareLines(places, "index");
		expect(lines.map((l) => l.name)).toEqual(["Pará"]);
		expect(lines[0]?.current.at(-1)).toEqual({ day: 14, value: 50 });
		expect(lines[0]?.average.at(-1)).toEqual({ day: 14, value: 100 });
	});
});
