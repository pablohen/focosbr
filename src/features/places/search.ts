/**
 * Place search for the header: states, biomes and IBGE municipalities matched by
 * name, ignoring accents and case. Pure, so it can be tested; the browser
 * loads the municipality list only when the search opens.
 */
import { STATE_NAMES } from "../fires/states";
import { BIOMES } from "./biomes";
import { isState, type MunicipalityList, slugify } from "./places";

export type SearchEntry = {
	kind: "country" | "state" | "biome" | "city";
	uf: string;
	/** IBGE's name. */
	name: string;
	/** `slugify(name)`: the matching key, and the city's or biome's URL segment. */
	slug: string;
};

/** Brazil, then every state, biome and municipality. */
export function searchIndex(list: MunicipalityList): SearchEntry[] {
	const states = Object.entries(STATE_NAMES).map(([uf, name]) => ({
		kind: "state" as const,
		uf,
		name,
		slug: slugify(name),
	}));
	const cities = Object.entries(list).flatMap(([uf, rows]) =>
		rows.map(([, name]) => ({
			kind: "city" as const,
			uf,
			name,
			slug: slugify(name),
		})),
	);
	const biomes = BIOMES.map((b) => ({
		kind: "biome" as const,
		uf: "",
		name: b.name,
		slug: b.slug,
	}));
	const brazil = {
		kind: "country" as const,
		uf: "",
		name: "Brasil",
		slug: "brasil",
	};
	return [brazil, ...states, ...biomes, ...cities];
}

const KIND_ORDER = { country: 0, state: 1, biome: 2, city: 3 } as const;

/**
 * The best `limit` matches for `query`: whole name, then name prefix, then
 * a word's prefix, then anywhere; states, then biomes, then cities, then
 * shorter names.
 * A trailing state code narrows cities to that state ("altamira pa"), and a
 * bare state code finds its state ("sp").
 */
export function searchPlaces(
	entries: SearchEntry[],
	query: string,
	limit = 8,
): SearchEntry[] {
	let q = slugify(query);
	if (!q) return [];
	let uf: string | undefined;
	const words = q.split("-");
	const last = words.at(-1)?.toUpperCase() ?? "";
	if (words.length > 1 && last.length === 2 && isState(last)) {
		uf = last;
		q = words.slice(0, -1).join("-");
	}
	const score = (e: SearchEntry) => {
		if (e.kind === "state" && !uf && e.uf.toLowerCase() === q) return 0;
		if (e.slug === q) return 0;
		if (e.slug.startsWith(q)) return 1;
		if (e.slug.includes(`-${q}`)) return 2;
		if (e.slug.includes(q)) return 3;
		return -1;
	};
	const hits: { e: SearchEntry; s: number }[] = [];
	for (const e of entries) {
		if (uf && e.uf !== uf) continue;
		const s = score(e);
		if (s >= 0) hits.push({ e, s });
	}
	return hits
		.sort(
			(a, b) =>
				a.s - b.s ||
				KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] ||
				a.e.name.length - b.e.name.length ||
				a.e.name.localeCompare(b.e.name, "pt-BR"),
		)
		.slice(0, limit)
		.map((h) => h.e);
}

/** A search result's region key (see region-key.ts): "br", "pa", "pa/altamira", "biome/amazonia". */
export function entryKey(e: SearchEntry): string {
	switch (e.kind) {
		case "country":
			return "br";
		case "state":
			return e.uf.toLowerCase();
		case "biome":
			return `biome/${e.slug}`;
		case "city":
			return `${e.uf.toLowerCase()}/${e.slug}`;
	}
}
