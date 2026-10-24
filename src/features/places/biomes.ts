/**
 * Brazil's six biomes as INPE names them (IBGE's), with English-free URL
 * slugs for their pages: /biomes/amazonia. Names stay verbatim: they're
 * the map's biome filter values.
 */
import { slugify } from "./places";

/** INPE's names, with the article the UI needs ("na Amazônia", "no Cerrado"). */
const NAMES = [
	["Amazônia", "na"],
	["Cerrado", "no"],
	["Caatinga", "na"],
	["Mata Atlântica", "na"],
	["Pantanal", "no"],
	["Pampa", "no"],
] as const;

export type Biome = {
	name: string;
	slug: string;
	/** "na Amazônia": the name after "em", contracted. */
	in: string;
};

export const BIOMES: Biome[] = NAMES.map(([name, article]) => ({
	name,
	slug: slugify(name),
	in: `${article} ${name}`,
}));

/** A biome by its slug ("mata-atlantica"), or undefined. */
export const biomeBySlug = (slug: string) =>
	BIOMES.find((b) => b.slug === slug);

/** A biome by INPE's name ("Mata Atlântica"), or undefined (empty or unknown). */
export const biomeByName = (name: string) =>
	BIOMES.find((b) => b.name === name);

export const biomePath = (slug: string) => `/biomes/${slug}`;

/** The biome's `_id` in the history collection: "biome/amazonia". */
export const biomeHistoryId = (slug: string) => `biome/${slug}`;
