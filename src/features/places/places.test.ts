import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	MunicipalityListSchema,
	municipalityIndex,
	municipalityPath,
	placeLabel,
	slugify,
	splitPlaceLabel,
	statePath,
} from "./places";

describe("slugify", () => {
	it("folds accents, case and punctuation", () => {
		expect(slugify("São Félix do Xingu")).toBe("sao-felix-do-xingu");
		expect(slugify("Alta Floresta D'Oeste")).toBe("alta-floresta-d-oeste");
	});
});

describe("labels and paths", () => {
	it("round-trips a place label", () => {
		expect(placeLabel("Altamira", "PA")).toBe("Altamira (PA)");
		expect(splitPlaceLabel("Altamira (PA)")).toEqual({
			name: "Altamira",
			uf: "PA",
		});
		expect(splitPlaceLabel("Altamira")).toBeNull();
	});
	it("builds page paths", () => {
		expect(statePath("PA")).toBe("/states/pa");
		expect(municipalityPath("PA", "São Félix do Xingu")).toBe(
			"/cities/pa/sao-felix-do-xingu",
		);
	});
});

describe("municipalityIndex", () => {
	const list = MunicipalityListSchema.parse(
		JSON.parse(readFileSync("src/features/places/municipalities.json", "utf8")),
	);
	const index = municipalityIndex(list);

	it("covers every municipality, with unique slugs per state", () => {
		expect(index.all().length).toBeGreaterThan(5500);
		const keys = index.all().map((m) => `${m.uf}/${slugify(m.name)}`);
		expect(new Set(keys).size).toBe(keys.length);
	});
	it("finds by IBGE code and by state + slug", () => {
		expect(index.byId.get(1500602)).toEqual({
			id: 1500602,
			name: "Altamira",
			uf: "PA",
		});
		expect(index.find("pa", "altamira")?.id).toBe(1500602);
		expect(index.find("PA", "nao-existe")).toBeUndefined();
	});
});
