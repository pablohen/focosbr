import { describe, expect, it } from "vitest";
import {
	ATTRIBUTION,
	exportFileName,
	exportRows,
	toCsv,
	toGeoJson,
} from "./export";
import type { FiresResponse } from "./schemas";
import { fireGroups } from "./view";

const DATA: FiresResponse = {
	generatedAt: "2026-10-24T05:40:00.000Z",
	hours: 24,
	latestAt: "2026-10-24T05:30:00.000Z",
	sourceUpdatedAt: null,
	satellites: ["NOAA-20", "GOES-19"],
	states: ["PA", "MT"],
	places: ['Pau D"Arco, Velho (PA)', ""],
	biomes: ["Amazônia", ""],
	fires: {
		lon: [-50.1234, -59],
		lat: [-7.5, -9],
		t: [Date.UTC(2026, 9, 24, 5, 30) / 1000, Date.UTC(2026, 9, 24, 1) / 1000],
		frp: [12.5, null],
		sat: [0, 1],
		state: [0, 1],
		place: [0, 1],
		biome: [0, 1],
		prelim: [0, 1],
		dry: [22, null],
		rain: [0, null],
		risk: [0.98, null],
	},
};
const rows = exportRows(DATA, [0, 1], fireGroups(DATA, [0, 1]));

describe("exportRows", () => {
	it("flattens a detection with Brasília time and split place", () => {
		expect(rows[0]).toEqual({
			id_fogo: 0,
			data_hora_utc: "2026-10-24T05:30:00.000Z",
			data_hora_brasilia: "2026-10-24 02:30",
			latitude: -7.5,
			longitude: -50.1234,
			satelite: "NOAA-20",
			sensor: "VIIRS",
			municipio: 'Pau D"Arco, Velho',
			uf: "PA",
			bioma: "Amazônia",
			frp_mw: 12.5,
			dias_sem_chuva: 22,
			precipitacao_mm: 0,
			risco_fogo: 0.98,
			preliminar: 0,
		});
		expect(rows[1]).toMatchObject({
			municipio: "",
			frp_mw: null,
			risco_fogo: null,
			preliminar: 1,
			data_hora_brasilia: "2026-10-23 22:00",
		});
	});
});

describe("toCsv", () => {
	it("writes a BOM, a header and RFC 4180 fields", () => {
		const csv = toCsv(rows);
		expect(csv.startsWith("﻿id_fogo,data_hora_utc,")).toBe(true);
		const lines = csv.slice(1).trimEnd().split("\r\n");
		expect(lines).toHaveLength(3);
		expect(lines[1]).toBe(
			'0,2026-10-24T05:30:00.000Z,2026-10-24 02:30,-7.5,-50.1234,NOAA-20,VIIRS,"Pau D""Arco, Velho",PA,Amazônia,12.5,22,0,0.98,0',
		);
		// Missing values are empty fields, not "null" or 0.
		expect(lines[2]).toBe(
			"1,2026-10-24T01:00:00.000Z,2026-10-23 22:00,-9,-59,GOES-19,GOES,,MT,,,,,,1",
		);
	});
});

describe("toGeoJson", () => {
	it("writes [lon, lat] points with the rest as properties", () => {
		const fc = toGeoJson(rows);
		expect(fc.attribution).toBe(ATTRIBUTION);
		expect(fc.features[0]?.geometry.coordinates).toEqual([-50.1234, -7.5]);
		expect(fc.features[0]?.properties).not.toHaveProperty("latitude");
		expect(fc.features[0]?.properties.uf).toBe("PA");
	});
});

describe("exportFileName", () => {
	const now = new Date(Date.UTC(2026, 9, 24, 5, 30));
	it("names the region, window and Brasília time", () => {
		expect(exportFileName("csv", {}, 24, now)).toBe(
			"focos-brasil-24h-20261024-0230.csv",
		);
		expect(
			exportFileName(
				"geojson",
				{ uf: "PA", place: "São Félix do Xingu (PA)", biome: "Amazônia" },
				6,
				now,
			),
		).toBe("focos-sao-felix-do-xingu-pa-amazonia-6h-20261024-0230.geojson");
	});
});
