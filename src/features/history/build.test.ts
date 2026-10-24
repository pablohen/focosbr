import { describe, expect, it } from "vitest";
import {
	anomalyStep,
	CALENDAR_STEPS,
	calendarStep,
	createHistoryAggregator,
	dayOfYear,
	localKeys,
	regionSeries,
	seasonCurve,
	ytdSummary,
} from "./build";
import { DAYS_SHOWN, FIRST_YEAR, MONTHS_SHOWN } from "./schemas";

const at = (y: number, m: number, d: number, h = 15) =>
	Date.UTC(y, m - 1, d, h);

describe("localKeys", () => {
	it("buckets by Brasília time", () => {
		expect(localKeys(at(2026, 10, 24, 14))).toEqual({
			month: "2026-10",
			day: "2026-10-24",
		});
		// 01:00 UTC on 1 Nov is still 31 Oct in Brasília.
		expect(localKeys(at(2026, 11, 1, 1))).toEqual({
			month: "2026-10",
			day: "2026-10-31",
		});
	});
});

describe("createHistoryAggregator", () => {
	it("counts reference detections by month and daily ones by day, per region", () => {
		const agg = createHistoryAggregator();
		agg.add({
			kind: "reference",
			time: at(2003, 1, 1),
			uf: "PA",
			cityId: 1500602,
		});
		agg.add({ kind: "reference", time: at(2003, 1, 9), uf: "PA" });
		agg.add({
			kind: "daily",
			time: at(2026, 10, 23),
			uf: "MT",
			cityId: 5100102,
		});
		const byId = new Map(agg.regions().map((r) => [r.id, r]));

		expect(byId.get("BR")?.months.get("2003-01")).toBe(2);
		expect(byId.get("BR")?.refDays.get("2003-01-01")).toBe(1);
		expect(byId.get("BR")?.refDays.get("2026-10-23")).toBeUndefined();
		expect(byId.get("BR")?.days.get("2026-10-23")).toBe(1);
		expect(byId.get("PA")).toMatchObject({ kind: "state", uf: "PA" });
		expect(byId.get("PA")?.months.get("2003-01")).toBe(2);
		expect(byId.get("1500602")).toMatchObject({
			kind: "city",
			uf: "PA",
			cityId: 1500602,
		});
		expect(byId.get("1500602")?.months.get("2003-01")).toBe(1);
		expect(byId.get("MT")?.months.size).toBe(0);
		expect(byId.get("5100102")?.days.get("2026-10-23")).toBe(1);
	});
});

describe("regionSeries", () => {
	const now = new Date(at(2026, 10, 24, 15));
	const stored = {
		months: { "2003-03": 5, "2003-08": 7, "2025-11": 4, "2026-10": 2 },
		refDays: {},
		days: { "2026-10-24": 3, "2026-10-01": 1 },
		updatedAt: new Date(at(2026, 10, 24, 9)),
	};

	it("sums years since 2003 and marks the current one partial", () => {
		const s = regionSeries(stored, now);
		expect(s.years).toHaveLength(2026 - FIRST_YEAR + 1);
		expect(s.years[0]).toEqual({ key: "2003", count: 12, partial: false });
		expect(s.years.at(-1)).toEqual({ key: "2026", count: 2, partial: true });
		expect(s.years.at(-2)).toEqual({ key: "2025", count: 4, partial: false });
	});
	it("lists the last months and days, ending now, zeros included", () => {
		const s = regionSeries(stored, now);
		expect(s.months).toHaveLength(MONTHS_SHOWN);
		expect(s.months[0]?.key).toBe("2024-11");
		expect(s.months.at(-1)).toEqual({
			key: "2026-10",
			count: 2,
			partial: true,
		});
		expect(s.months.at(-12)).toEqual({
			key: "2025-11",
			count: 4,
			partial: false,
		});
		expect(s.days).toHaveLength(DAYS_SHOWN);
		expect(s.days.at(-1)).toEqual({
			key: "2026-10-24",
			count: 3,
			partial: true,
		});
		expect(s.days.find((d) => d.key === "2026-10-01")?.count).toBe(1);
		// Day counts here start inside the 90 days shown.
		expect(s.daysSince).toBe("2026-10-01");
	});
});

describe("ytdSummary", () => {
	// 24 Oct 2026 at noon in Brasília: counts run through 23 Oct of each year.
	const now = new Date(at(2026, 10, 24, 15));
	const refDays = {
		"2003-01-05": 10,
		"2003-10-23": 2,
		"2003-10-24": 100, // after the cut
		"2025-03-01": 4,
		"2026-02-01": 9,
		"2026-10-24": 50, // today: still counting
	};

	it("compares the same period of every year", () => {
		const y = ytdSummary(refDays, now);
		expect(y.through).toBe("2026-10-23");
		expect(y.current).toBe(9);
		expect(y.years[0]).toEqual({ year: 2003, count: 12 });
		expect(y.years.at(-2)).toEqual({ year: 2025, count: 4 });
		// (12 + 4) over 23 past years.
		expect(y.average).toBe(Math.round((16 / 23) * 10) / 10);
		expect(y.ratio).toBe(Math.round((9 / (16 / 23)) * 1000) / 1000);
		expect(y.record).toEqual({ year: 2003, count: 12 });
	});
	it("has no ratio or record without past detections", () => {
		const y = ytdSummary({ "2026-01-01": 3 }, now);
		expect(y.ratio).toBeNull();
		expect(y.record).toBeNull();
	});
});

describe("regionSeries calendar", () => {
	it("lays months out by year", () => {
		const s = regionSeries(
			{
				months: { "2003-09": 7, "2026-10": 2 },
				refDays: {},
				days: {},
				updatedAt: new Date(),
			},
			new Date(at(2026, 10, 24, 15)),
		);
		expect(s.calendar[0]).toEqual({
			year: 2003,
			months: [0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0],
		});
		expect(s.calendar.at(-1)?.months[9]).toBe(2);
	});
});

describe("calendarStep", () => {
	it("keeps empty months apart from the ramp", () => {
		expect(calendarStep(0, 100)).toBe(0);
		expect(calendarStep(0, 0)).toBe(0);
	});

	it("puts the busiest month on the last step and any detection on the first or above", () => {
		expect(calendarStep(100, 100)).toBe(CALENDAR_STEPS);
		expect(calendarStep(1, 10_000)).toBe(1);
	});

	it("grows with the square root, so quiet months stay visible", () => {
		// A month with a quarter of the peak is halfway up the ramp.
		expect(calendarStep(25, 100)).toBe(3);
		const steps = [1, 4, 9, 16, 36, 64, 100].map((n) => calendarStep(n, 100));
		expect(steps).toEqual([...steps].sort((a, b) => a - b));
	});
});

describe("dayOfYear", () => {
	it("counts on a non-leap year", () => {
		expect(dayOfYear("01-01")).toBe(1);
		expect(dayOfYear("03-01")).toBe(60);
		expect(dayOfYear("02-29")).toBe(60);
		expect(dayOfYear("12-31")).toBe(365);
	});
});

describe("seasonCurve", () => {
	const now = new Date(at(2026, 10, 24, 15));
	const refDays = {
		"2003-01-05": 10, // before the first sample (day 7)
		"2003-12-31": 5,
		"2004-01-20": 30,
		"2026-01-03": 4,
		"2026-10-23": 6, // yesterday: the last counted day
		"2026-10-24": 50, // today: still counting
	};
	const s = seasonCurve(refDays, now);

	it("samples every week and the last day of the year", () => {
		expect(s.days[0]).toBe(7);
		expect(s.days.at(-1)).toBe(365);
		expect(s.min).toHaveLength(s.days.length);
	});

	it("keeps the range, average and record of past years", () => {
		// Day 7: 2003 has 10, 2004 and the empty years 0.
		expect(s.max[0]).toBe(10);
		expect(s.min[0]).toBe(0);
		expect(s.max.at(-1)).toBe(30);
		expect(s.record).toMatchObject({ year: 2004 });
		expect(s.average.at(-1)).toBe(Math.round(45 / (2026 - FIRST_YEAR)));
	});

	it("runs this year up to yesterday, without today", () => {
		const last = s.current.points.at(-1);
		expect(s.current.year).toBe(2026);
		expect(last).toEqual({ day: dayOfYear("10-23"), count: 10 });
		expect(s.current.points[0]).toEqual({ day: 7, count: 4 });
	});
});

describe("anomalyStep", () => {
	it("bins the ratio to the average symmetrically", () => {
		expect(
			[0.3, 0.5, 0.79, 0.8, 1, 1.25, 1.26, 2, 2.01].map(anomalyStep),
		).toEqual([-2, -1, -1, 0, 0, 0, 1, 1, 2]);
	});

	it("treats no past detections as about average", () => {
		expect(anomalyStep(null)).toBe(0);
	});
});
