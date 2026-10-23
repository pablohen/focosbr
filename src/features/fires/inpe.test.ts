import { describe, expect, it } from "vitest";
import {
	buildFiresResponse,
	dailyFileUrl,
	daysForWindow,
	parseInpeCsv,
	sensorOf,
	titleCase,
} from "./inpe";

// Two rows as INPE publishes them (leading spaces in lat/lon included).
const CSV = `id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp
10c546bd-375a-3e5c-9b68-d988c2f173f4, -10.601900, -45.000600,2026-10-23 00:00:00,GOES-19,CORRENTE,PIAUÍ,Brasil,2202901,22,33,,,,Cerrado,70.9
cd42f0ef-b292-3c96-8a2d-525cd29d47c5,  -4.101700, -44.229700,2026-10-23 20:40:00,NOAA-20,SÃO JOSÉ DO RIBAMAR,MARANHÃO,Brasil,2111201,21,33,12,0,0.8,Amazônia,
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
		});
		expect(rows[1]?.place).toBe("São José do Ribamar (MA)");
		expect(rows[1]?.frp).toBeNull();
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
