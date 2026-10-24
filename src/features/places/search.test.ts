import { describe, expect, it } from "vitest";
import { entryKey, searchIndex, searchPlaces } from "./search";

const index = searchIndex({
	PA: [
		[1500602, "Altamira"],
		[1507300, "São Félix do Xingu"],
		[1506807, "Santarém"],
	],
	MA: [[2100550, "Altamira do Maranhão"]],
	SP: [[3550308, "São Paulo"]],
});
const names = (q: string) =>
	searchPlaces(index, q).map((e) => `${e.name}/${e.uf}`);

describe("searchPlaces", () => {
	it("ignores accents and case", () => {
		expect(names("SANTAREM")).toEqual(["Santarém/PA"]);
		expect(names("felix")).toEqual(["São Félix do Xingu/PA"]);
	});

	it("ranks exact names, then prefixes, then words", () => {
		expect(names("altamira")).toEqual([
			"Altamira/PA",
			"Altamira do Maranhão/MA",
		]);
		expect(
			searchPlaces(index, "sao").map((e) => `${e.kind}:${e.name}`),
		).toEqual(["state:São Paulo", "city:São Paulo", "city:São Félix do Xingu"]);
	});

	it("narrows to a state with a trailing state code", () => {
		expect(names("altamira ma")).toEqual(["Altamira do Maranhão/MA"]);
	});

	it("finds a state by its code and puts states first", () => {
		expect(searchPlaces(index, "sp")[0]).toMatchObject({
			kind: "state",
			uf: "SP",
		});
		expect(searchPlaces(index, "para")[0]).toMatchObject({
			kind: "state",
			uf: "PA",
		});
	});

	it("finds biomes, after states and before cities", () => {
		expect(searchPlaces(index, "mata")[0]).toMatchObject({
			kind: "biome",
			slug: "mata-atlantica",
		});
		expect(
			searchPlaces(index, "amazon").map((e) => `${e.kind}:${e.name}`),
		).toEqual(["state:Amazonas", "biome:Amazônia"]);
	});

	it("finds Brazil and keys every result", () => {
		expect(searchPlaces(index, "brasil")[0]).toMatchObject({ kind: "country" });
		expect(
			["brasil", "sp", "pampa", "santarem"].map((q) => {
				const e = searchPlaces(index, q)[0];
				return e && entryKey(e);
			}),
		).toEqual(["br", "sp", "biome/pampa", "pa/santarem"]);
	});

	it("returns nothing for an empty query and respects the limit", () => {
		expect(searchPlaces(index, "  ")).toEqual([]);
		expect(searchPlaces(index, "a", 2)).toHaveLength(2);
	});
});
