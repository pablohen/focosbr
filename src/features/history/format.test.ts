import { describe, expect, it } from "vitest";
import {
	percentVsAverage,
	versusAverage,
	weekLabel,
	yearSentence,
	ytdPeriod,
} from "./format";

describe("ytdPeriod", () => {
	it("names the period from 1 January", () => {
		expect(ytdPeriod("2026-10-23")).toBe("1º de janeiro a 23 de outubro");
		expect(ytdPeriod("2026-01-01")).toBe("1º de janeiro a 1 de janeiro");
	});
});

describe("versusAverage", () => {
	it("says how far above or below the average, rounded", () => {
		expect(versusAverage(0.714)).toBe("29% abaixo da média");
		expect(versusAverage(1.124)).toBe("12% acima da média");
		expect(versusAverage(3)).toBe("200% acima da média");
	});

	it("calls a rounded zero the average", () => {
		expect(versusAverage(1.004)).toBe("na média");
	});
});

describe("percentVsAverage", () => {
	it("signs the difference with a true minus", () => {
		expect(percentVsAverage(1.124)).toBe("+12%");
		expect(percentVsAverage(0.714)).toBe("−29%");
		expect(percentVsAverage(0.999)).toBe("0%");
	});
});

describe("weekLabel", () => {
	it("names the week, across months too", () => {
		expect(weekLabel("2026-10-18", "2026-10-24")).toBe(
			"18 a 24 de outubro de 2026",
		);
		expect(weekLabel("2026-09-28", "2026-10-04")).toBe(
			"28 de setembro a 4 de outubro de 2026",
		);
	});
});

describe("yearSentence", () => {
	const totals = [
		{ year: 2003, count: 300 },
		{ year: 2004, count: 100 },
		{ year: 2005, count: 200 },
		{ year: 2006, count: 50 },
	];
	it("ranks a complete year among complete years", () => {
		expect(
			yearSentence(
				{ year: 2005, partial: false, through: "2006-10-23", totals },
				2003,
			),
		).toBe(
			"Em 2005, 200 focos pelo satélite de referência do INPE: o 2º ano com mais focos entre os 3 desde 2003 (média de 200 por ano).",
		);
	});

	it("says the current year is still counting", () => {
		expect(
			yearSentence(
				{ year: 2006, partial: true, through: "2006-10-23", totals },
				2003,
			),
		).toBe(
			"Em 2006, de 1º de janeiro a 23 de outubro: 50 focos pelo satélite de referência do INPE (ano em curso). A média de um ano inteiro desde 2003 é de 200.",
		);
	});
});
