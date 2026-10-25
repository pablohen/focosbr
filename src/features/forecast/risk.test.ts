import { describe, expect, it } from "vitest";
import { addDays, NO_DATA, summarizeRisk, upcomingDays } from "./risk";

describe("summarizeRisk", () => {
	it("averages the risk and the share at high risk, skipping no-data", () => {
		expect(summarizeRisk([0.2, 0.7, 1, NO_DATA, Number.NaN])).toEqual({
			mean: 0.63,
			high: 0.67,
		});
	});

	it("has nothing for a region with no data", () => {
		expect(summarizeRisk([NO_DATA])).toBeNull();
		expect(summarizeRisk([])).toBeNull();
	});
});

describe("upcomingDays", () => {
	it("drops days already past", () => {
		const days = ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].map(
			(date) => ({ date, mean: 0.5, high: 0.2 }),
		);
		expect(upcomingDays(days, "2026-10-25").map((d) => d.date)).toEqual([
			"2026-10-25",
			"2026-10-26",
		]);
		expect(upcomingDays(days, "2026-10-27")).toEqual([]);
	});
});

describe("addDays", () => {
	it("crosses months", () => {
		expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
	});
});
