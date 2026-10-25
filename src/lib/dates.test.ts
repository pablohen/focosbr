import { describe, expect, it } from "vitest";
import {
	longDate,
	longDayMonth,
	shortDate,
	shortDayMonth,
	shortMoment,
} from "./dates";

describe("dates", () => {
	it("formats calendar days without shifting them", () => {
		expect(longDate("2026-10-23")).toBe("23 de outubro de 2026");
		expect(longDayMonth("2026-01-01")).toBe("1 de janeiro");
		expect(shortDate("2026-10-23")).toBe("23 de out. de 2026");
		expect(shortDayMonth("2026-10-23")).toBe("23 de out.");
	});

	it("formats moments in Brasília", () => {
		// 01:30 UTC on 24 Oct is 22:30 on the 23rd in Brasília.
		expect(shortMoment(new Date("2026-10-24T01:30:00Z"))).toBe(
			"23 de out., 22:30",
		);
	});

	it("never writes a numeric day/month", () => {
		for (const s of [
			longDate("2026-10-23"),
			shortDate("2026-10-23"),
			shortMoment(new Date("2026-10-24T01:30:00Z")),
		])
			expect(s).not.toMatch(/\d{1,2}\/\d{1,2}/);
	});
});
