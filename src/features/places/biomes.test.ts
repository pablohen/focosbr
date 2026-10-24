import { describe, expect, it } from "vitest";
import { BIOMES, biomeByName, biomeBySlug, biomeHistoryId } from "./biomes";

describe("biomes", () => {
	it("slugs INPE's names for URLs", () => {
		expect(BIOMES.map((b) => b.slug)).toEqual([
			"amazonia",
			"cerrado",
			"caatinga",
			"mata-atlantica",
			"pantanal",
			"pampa",
		]);
	});

	it("looks biomes up by slug and by name, and not by an empty name", () => {
		expect(biomeBySlug("mata-atlantica")?.name).toBe("Mata Atlântica");
		expect(biomeByName("Amazônia")?.slug).toBe("amazonia");
		expect(biomeByName("")).toBeUndefined();
		expect(biomeHistoryId("pampa")).toBe("biome/pampa");
	});
});
