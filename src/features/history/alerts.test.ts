import { describe, expect, it } from "vitest";
import { alertsRss, alertText, regionAlerts } from "./alerts";
import type { Ytd } from "./schemas";

const ytd = (over: Partial<Ytd>): Ytd => ({
	through: "2026-10-23",
	current: 300,
	average: 100,
	ratio: 3,
	record: null,
	years: [],
	...over,
});

describe("regionAlerts", () => {
	it("flags a place at double its average, once per year", () => {
		const [a] = regionAlerts({ id: "1506807", kind: "city" }, {}, ytd({}));
		expect(a).toMatchObject({
			_id: "double:1506807:2026",
			type: "double",
			date: "2026-10-23",
			ratio: 3,
		});
	});

	it("ignores places below double, or too small for a ratio to mean much", () => {
		const id = { id: "1", kind: "city" as const };
		expect(regionAlerts(id, {}, ytd({ ratio: 1.9 }))).toEqual([]);
		expect(regionAlerts(id, {}, ytd({ average: 20, current: 60 }))).toEqual([]);
		expect(regionAlerts(id, {}, ytd({ ratio: null }))).toEqual([]);
	});

	it("flags a record day for big regions only", () => {
		const refDays = { "2010-08-20": 40, "2026-10-22": 5, "2026-10-23": 41 };
		const quiet = ytd({ ratio: 1 });
		expect(
			regionAlerts({ id: "PA", kind: "state" }, refDays, quiet),
		).toMatchObject([
			{
				_id: "record-day:PA:2026-10-23",
				current: 41,
				previous: { day: "2010-08-20", count: 40 },
			},
		]);
		expect(regionAlerts({ id: "1", kind: "city" }, refDays, quiet)).toEqual([]);
	});

	it("needs a real record: above the previous one and not tiny", () => {
		const quiet = ytd({ ratio: 1 });
		const state = { id: "PA", kind: "state" as const };
		expect(
			regionAlerts(state, { "2010-08-20": 41, "2026-10-23": 41 }, quiet),
		).toEqual([]);
		expect(
			regionAlerts(state, { "2010-08-20": 3, "2026-10-23": 9 }, quiet),
		).toEqual([]);
	});
});

const double = {
	_id: "double:1506807:2026",
	type: "double" as const,
	name: "Santarém (PA)",
	path: "/states/pa/santarem",
	date: "2026-10-23",
	current: 499,
	average: 139,
	ratio: 3.59,
	previous: null,
	createdAt: new Date(Date.UTC(2026, 9, 24, 12, 40)),
};

describe("alertText", () => {
	it("words a place above double", () => {
		expect(alertText(double, 2003)).toEqual({
			title: "Santarém (PA) passa do dobro da média de focos no ano",
			summary:
				"De 1º de janeiro a 23 de outubro de 2026: 499 focos pelo satélite de referência, 259% acima da média do mesmo período desde 2003 (139).",
		});
	});

	it("words a record day with the previous record", () => {
		const t = alertText(
			{
				type: "record-day",
				name: "Pará",
				date: "2026-10-23",
				current: 1234,
				previous: { day: "2010-08-20", count: 1200 },
			},
			2003,
		);
		expect(t.title).toBe("Pará tem o dia com mais focos desde 2003");
		expect(t.summary).toBe(
			"1.234 focos em 23 de outubro de 2026 pelo satélite de referência; o recorde anterior era de 1.200, em 20 de agosto de 2010.",
		);
	});
});

describe("alertsRss", () => {
	it("writes escaped items with absolute links", () => {
		const xml = alertsRss(
			[{ ...double, name: "A & B" }],
			"https://focosbr.vercel.app",
			2003,
		);
		expect(xml).toContain("<title>A &amp; B passa do dobro");
		expect(xml).toContain(
			"<link>https://focosbr.vercel.app/states/pa/santarem</link>",
		);
		expect(xml).toContain("<pubDate>Sat, 24 Oct 2026 12:40:00 GMT</pubDate>");
		expect(xml.match(/<item>/g)).toHaveLength(1);
	});
});
