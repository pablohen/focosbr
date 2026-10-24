/**
 * Place search for the header: states and IBGE municipalities matched by
 * name, ignoring accents and case. Pure, so it can be tested; the browser
 * loads the municipality list only when the search opens.
 */
import { STATE_NAMES } from "../fires/states";
import { isState, type MunicipalityList, slugify } from "./places";

export type SearchEntry = {
	kind: "state" | "city";
	uf: string;
	/** IBGE's name. */
	name: string;
	/** `slugify(name)`: the matching key, and the city's URL segment. */
	slug: string;
};

/** Every state and municipality, states first. */
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
	return [...states, ...cities];
}

/**
 * The best `limit` matches for `query`: whole name, then name prefix, then
 * a word's prefix, then anywhere; states before cities, then shorter names.
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
				(a.e.kind === b.e.kind ? 0 : a.e.kind === "state" ? -1 : 1) ||
				a.e.name.length - b.e.name.length ||
				a.e.name.localeCompare(b.e.name, "pt-BR"),
		)
		.slice(0, limit)
		.map((h) => h.e);
}
