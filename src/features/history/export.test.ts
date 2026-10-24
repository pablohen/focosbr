import { describe, expect, it } from "vitest";
import { regionSeries } from "./build";
import { historyCsv, historyFileName } from "./export";

const now = new Date(Date.UTC(2026, 9, 24, 15));
const h = regionSeries(
	{
		months: { "2003-08": 7, "2026-10": 2 },
		refDays: { "2003-01-05": 10, "2026-10-01": 2 },
		days: { "2026-10-24": 3 },
		updatedAt: now,
	},
	now,
);
const lines = (csv: string) => csv.replace("﻿", "").trim().split("\r\n");

describe("historyCsv", () => {
	it("lists years with the current one marked partial", () => {
		const rows = lines(historyCsv("anos", h));
		expect(rows[0]).toBe("ano,focos_satelite_referencia,parcial");
		expect(rows[1]).toBe("2003,7,0");
		expect(rows.at(-1)).toBe("2026,2,1");
	});

	it("lists every month up to the current one, and no later", () => {
		const rows = lines(historyCsv("meses", h));
		expect(rows).toContain("2003-08,7,0");
		expect(rows.at(-1)).toBe("2026-10,2,1");
		expect(rows).toHaveLength(1 + 23 * 12 + 10);
	});

	it("cuts every year at the same day", () => {
		const rows = lines(historyCsv("mesmo-periodo", h));
		expect(rows[1]).toBe("2003,2003-01-01,2003-10-23,10");
		expect(rows.at(-1)).toBe("2026,2026-01-01,2026-10-23,2");
	});

	it("leaves this year's cells empty after yesterday on the season table", () => {
		const rows = lines(historyCsv("temporada", h));
		expect(rows[0]).toBe(
			"dia_do_ano,ate,acumulado_2026,media,minimo,maximo,recorde_2003",
		);
		expect(rows[1]?.startsWith("7,01-07,0,")).toBe(true);
		expect(rows.at(-1)?.startsWith("365,12-31,,")).toBe(true);
	});

	it("lists the last days, today partial", () => {
		const rows = lines(historyCsv("dias", h));
		expect(rows.at(-1)).toBe("2026-10-24,3,1");
	});
});

describe("historyFileName", () => {
	it("names the region, table and last day", () => {
		expect(historyFileName("Altamira (PA)", "anos", "2026-10-23")).toBe(
			"historico-altamira-pa-anos-2026-10-23.csv",
		);
	});
});
