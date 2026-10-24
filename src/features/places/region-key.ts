/**
 * Region keys, shared by /compare and the open data API: "br" (Brazil),
 * "pa" (a state), "pa/altamira" (a city: state and IBGE name slug) and
 * "biome/amazonia" (a biome). Parsing is pure; the server checks the city
 * against IBGE's list.
 */
import { biomeBySlug } from "./biomes";
import { isState } from "./places";

export type RegionRef =
	| { kind: "country" }
	| { kind: "state"; uf: string }
	| { kind: "city"; uf: string; slug: string }
	| { kind: "biome"; slug: string };

/** A key's region, or null when it can't be one (unknown state or biome, bad shape). */
export function parseRegionKey(key: string): RegionRef | null {
	const parts = key.trim().toLowerCase().split("/");
	const [a = "", b, extra] = parts;
	if (extra !== undefined) return null;
	if (a === "br" && b === undefined) return { kind: "country" };
	if (a === "biome")
		return b && biomeBySlug(b) ? { kind: "biome", slug: b } : null;
	const uf = a.toUpperCase();
	if (!isState(uf)) return null;
	if (b === undefined) return { kind: "state", uf };
	return /^[a-z0-9-]{1,80}$/.test(b) ? { kind: "city", uf, slug: b } : null;
}

/** The key of a region: the inverse of `parseRegionKey`. */
export function regionKey(ref: RegionRef): string {
	switch (ref.kind) {
		case "country":
			return "br";
		case "state":
			return ref.uf.toLowerCase();
		case "city":
			return `${ref.uf.toLowerCase()}/${ref.slug}`;
		case "biome":
			return `biome/${ref.slug}`;
	}
}
