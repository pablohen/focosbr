import { describe, expect, it } from "vitest";
import {
	buildFiresResponse,
	dailyFileUrl,
	daysForWindow,
	gapSlots,
	mergeDetections,
	optionalNumber,
	parseInpeCsv,
	parseTenMinuteCsv,
	sensorOf,
	tenMinuteFileUrl,
	titleCase,
} from "./inpe";

// Two rows as INPE publishes them (leading spaces in lat/lon included).
const CSV = `id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp
10c546bd-375a-3e5c-9b68-d988c2f173f4, -10.601900, -45.000600,2026-10-23 00:00:00,GOES-19,CORRENTE,PIAUÍ,Brasil,2202901,22,33,,,,Cerrado,70.9
cd42f0ef-b292-3c96-8a2d-525cd29d47c5,  -4.101700, -44.229700,2026-10-23 20:40:00,NOAA-20,SÃO JOSÉ DO RIBAMAR,MARANHÃO,Brasil,2111201,21,33,12,0.5,0.8,Amazônia,
broken,row
`;

describe("parseInpeCsv", () => {
	it("reads rows by header name and skips malformed ones", () => {
		const rows = parseInpeCsv(CSV);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			lat: -10.6019,
			lon: -45.0006,
			time: Date.UTC(2026, 9, 23, 0, 0),
			satellite: "GOES-19",
			state: "PI",
			place: "Corrente (PI)",
			biome: "Cerrado",
			frp: 70.9,
			dryDays: null,
			rain: null,
			risk: null,
			preliminary: false,
		});
		expect(rows[1]?.place).toBe("São José do Ribamar (MA)");
		expect(rows[1]?.frp).toBeNull();
		expect(rows[1]).toMatchObject({ dryDays: 12, rain: 0.5, risk: 0.8 });
	});

	it("uses IBGE's official name when it knows the code", () => {
		const names = new Map([[2111201, "São José de Ribamar"]]);
		const rows = parseInpeCsv(CSV, (id) => names.get(id));
		expect(rows[1]?.place).toBe("São José de Ribamar (MA)");
		// Unknown codes fall back to INPE's name, title-cased.
		expect(rows[0]?.place).toBe("Corrente (PI)");
	});

	it("refuses a header it doesn't recognise", () => {
		expect(() => parseInpeCsv("lat,lon,data\n1,2,3")).toThrow(/header/);
	});
});

describe("titleCase", () => {
	it("keeps Portuguese particles lowercase", () => {
		expect(titleCase("SANTANA DO ARAGUAIA")).toBe("Santana do Araguaia");
		expect(titleCase("DE OLHO")).toBe("De Olho");
	});
});

describe("sensorOf", () => {
	it("groups satellites into sensor families", () => {
		expect(sensorOf("NPP-375D")).toBe("viirs");
		expect(sensorOf("NOAA-21")).toBe("viirs");
		expect(sensorOf("TERRA_M-T")).toBe("modis");
		expect(sensorOf("AQUA_M-M")).toBe("modis");
		expect(sensorOf("GOES-19")).toBe("goes");
		expect(sensorOf("METOP-C")).toBe("metop");
		expect(sensorOf("MSG-03")).toBe("msg");
		expect(sensorOf("NOAA-18")).toBe("other");
	});
});

describe("daysForWindow", () => {
	it("lists every UTC day the window touches", () => {
		const now = new Date(Date.UTC(2026, 9, 23, 3, 0));
		expect(daysForWindow(now, 6).map(dailyFileUrl)).toEqual([
			expect.stringMatching(/focos_diario_br_20261022\.csv$/),
			expect.stringMatching(/focos_diario_br_20261023\.csv$/),
		]);
		expect(daysForWindow(now, 48)).toHaveLength(3);
		expect(daysForWindow(new Date(Date.UTC(2026, 9, 23, 12)), 6)).toHaveLength(
			1,
		);
	});
});

describe("buildFiresResponse", () => {
	it("keeps the window, sorts oldest first and packs lookup tables", () => {
		const rows = parseInpeCsv(CSV);
		const now = new Date(Date.UTC(2026, 9, 23, 21, 0));
		const res = buildFiresResponse(rows, now, 24);
		expect(res.fires.t).toEqual([
			Date.UTC(2026, 9, 23, 0, 0) / 1000,
			Date.UTC(2026, 9, 23, 20, 40) / 1000,
		]);
		expect(res.places).toEqual(["Corrente (PI)", "São José do Ribamar (MA)"]);
		expect(res.fires.place).toEqual([0, 1]);
		expect(res.latestAt).toBe("2026-10-23T20:40:00.000Z");
		expect(res.sourceUpdatedAt).toBeNull();
		expect(
			buildFiresResponse(rows, now, 24, new Date(Date.UTC(2026, 9, 23, 20, 46)))
				.sourceUpdatedAt,
		).toBe("2026-10-23T20:46:00.000Z");

		const recent = buildFiresResponse(rows, now, 6);
		expect(recent.fires.t).toHaveLength(1);
		expect(recent.states).toEqual(["MA"]);
	});

	it("has no latest detection when the window is empty", () => {
		const res = buildFiresResponse([], new Date(), 6);
		expect(res.latestAt).toBeNull();
		expect(res.fires.lon).toEqual([]);
	});
});

// As INPE publishes them: South America, no state, biome or FRP.
const TEN_MIN = `lat,lon,satelite,data
  -3.967800, -55.736600,GOES-19,2026-10-23 21:40:00
   9.075100, -62.839300,GOES-19,2026-10-23 21:40:00
 -10.601900, -45.000600,NOAA-20,2026-10-23 18:32:00
`;
/** A stand-in for the IBGE outlines: Brazil is "west of -40 and south of 5". */
const locate = (lon: number, lat: number) =>
	lon < -40 && lat < 5 ? (lon < -50 ? "PA" : "PI") : null;

describe("parseTenMinuteCsv", () => {
	it("keeps detections in Brazil, located and marked preliminary", () => {
		const rows = parseTenMinuteCsv(TEN_MIN, locate);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			lat: -3.9678,
			lon: -55.7366,
			time: Date.UTC(2026, 9, 23, 21, 40),
			satellite: "GOES-19",
			state: "PA",
			place: "",
			biome: "",
			frp: null,
			dryDays: null,
			rain: null,
			risk: null,
			preliminary: true,
		});
		expect(rows[1]?.state).toBe("PI");
	});
	it("refuses a header it doesn't recognise", () => {
		expect(() => parseTenMinuteCsv("lat,lon\n1,2", locate)).toThrow(/header/);
	});
});

describe("gapSlots", () => {
	it("lists publish slots after the daily rewrite, up to now", () => {
		const cutoff = new Date(Date.UTC(2026, 9, 23, 21, 6, 2));
		const now = new Date(Date.UTC(2026, 9, 23, 21, 45));
		expect(gapSlots(cutoff, now).map(tenMinuteFileUrl)).toEqual([
			expect.stringMatching(/focos_10min_20261023_2110\.csv$/),
			expect.stringMatching(/focos_10min_20261023_2120\.csv$/),
			expect.stringMatching(/focos_10min_20261023_2130\.csv$/),
			expect.stringMatching(/focos_10min_20261023_2140\.csv$/),
		]);
	});
	it("is empty when the daily file is current, and capped at six hours", () => {
		const now = new Date(Date.UTC(2026, 9, 23, 21, 45));
		expect(gapSlots(new Date(Date.UTC(2026, 9, 23, 21, 41)), now)).toEqual([]);
		const stalled = gapSlots(new Date(Date.UTC(2026, 9, 22)), now);
		expect(stalled).toHaveLength(36);
		expect(stalled.at(-1)?.toISOString()).toBe("2026-10-23T21:40:00.000Z");
	});
});

describe("mergeDetections", () => {
	it("adds new detections and skips ones the daily file has", () => {
		const daily = parseInpeCsv(CSV);
		const extra = parseTenMinuteCsv(TEN_MIN, locate);
		// The NOAA-20 row repeats nothing (different time); copy one that does.
		const dup = { ...daily[0], preliminary: true } as (typeof daily)[0];
		const merged = mergeDetections(daily, [...extra, dup]);
		expect(merged).toHaveLength(daily.length + extra.length);
		expect(merged.filter((d) => d.preliminary)).toHaveLength(2);
	});
});

describe("buildFiresResponse prelim column", () => {
	it("flags preliminary detections", () => {
		const rows = mergeDetections(
			parseInpeCsv(CSV),
			parseTenMinuteCsv(TEN_MIN, locate),
		);
		const res = buildFiresResponse(
			rows,
			new Date(Date.UTC(2026, 9, 23, 22)),
			24,
		);
		// Oldest first: 00:00 daily, 18:32 preliminary, 20:40 daily, 21:40 preliminary.
		expect(res.fires.prelim).toEqual([0, 1, 0, 1]);
	});
});

describe("optionalNumber", () => {
	it("reads numbers and treats empty or INPE's -999 as missing", () => {
		expect(optionalNumber(" 0.95")).toBe(0.95);
		expect(optionalNumber("0")).toBe(0);
		expect(optionalNumber("")).toBeNull();
		expect(optionalNumber(undefined)).toBeNull();
		expect(optionalNumber("-999.0")).toBeNull();
		expect(optionalNumber("abc")).toBeNull();
	});
});
