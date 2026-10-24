import { describe, expect, it } from "vitest";
import { createHistoryAggregator, localKeys, regionSeries } from "./build";
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
