import { describe, expect, it } from "vitest";
import { versusAverage, ytdPeriod } from "./format";

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
