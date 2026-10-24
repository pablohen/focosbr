import { describe, expect, it } from "vitest";
import { cardHistoryId, cardPath, cardViewFrom, regionLabel } from "./card";

describe("cardPath", () => {
	it("is /og for the default view", () => {
		expect(cardPath({})).toBe("/og");
		expect(cardPath({ h: 24 })).toBe("/og");
	});
	it("keeps the view in a stable order and drops the map position", () => {
		expect(
			cardPath({
				city: "Altamira (PA)",
				state: "PA",
				h: 48,
				sensor: ["viirs", "goes"],
				...{ bbox: [-55, -10, -50, -5] },
			}),
		).toBe("/og?h=48&sensor=goes%2Cviirs&state=PA&city=Altamira+%28PA%29");
	});
});

describe("cardViewFrom", () => {
	it("reads back what cardPath wrote", () => {
		const view = {
			h: 6 as const,
			sensor: ["goes" as const],
			state: "MT",
			biome: "Cerrado",
		};
		const params = new URL(`https://x${cardPath(view)}`).searchParams;
		expect(cardViewFrom(params)).toEqual(view);
	});
	it("drops values the page wouldn't accept", () => {
		const params = new URLSearchParams("h=7&state=xx&sensor=radar");
		expect(cardViewFrom(params)).toEqual({});
	});
});

describe("regionLabel", () => {
	it("names the most specific region and the biome", () => {
		expect(regionLabel({})).toBe("Brasil");
		expect(regionLabel({ state: "MT" })).toBe("Mato Grosso");
		expect(regionLabel({ state: "PA", city: "Altamira (PA)" })).toBe(
			"Altamira (PA)",
		);
		expect(regionLabel({ biome: "Pantanal", state: "MS" })).toBe(
			"Mato Grosso do Sul · Pantanal",
		);
	});
});

describe("cardHistoryId", () => {
	const cityId = (label: string) =>
		label === "Altamira (PA)" ? 1500602 : undefined;
	const biomeSlug = (name: string) =>
		name === "Amazônia" ? "amazonia" : undefined;
	const id = (view: Parameters<typeof cardHistoryId>[0]) =>
		cardHistoryId(view, cityId, biomeSlug);

	it("names one region's history", () => {
		expect(id({})).toBe("BR");
		expect(id({ h: 48 })).toBe("BR");
		expect(id({ state: "PA" })).toBe("PA");
		expect(id({ state: "PA", city: "Altamira (PA)" })).toBe("1500602");
		expect(id({ biome: "Amazônia" })).toBe("biome/amazonia");
	});

	it("has none for sensors, combinations or unknown places", () => {
		expect(id({ sensor: ["viirs"] })).toBeNull();
		expect(id({ state: "PA", biome: "Amazônia" })).toBeNull();
		expect(id({ city: "Nowhere (PA)" })).toBeNull();
		expect(id({ biome: "Oceano" })).toBeNull();
	});
});
