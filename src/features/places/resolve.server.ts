import { STATE_NAMES } from "../fires/states";
import { BRAZIL_ID } from "../history/schemas";
import { biomeBySlug, biomeHistoryId, biomePath } from "./biomes";
import { municipalityPath, placeLabel, statePath } from "./places";
import { municipalities } from "./places.server";
import { parseRegionKey, type RegionRef, regionKey } from "./region-key";

/** A region key resolved for pages, history and the fire filters. */
export type ResolvedRegion = {
	key: string;
	kind: RegionRef["kind"];
	/** "Pará", "Altamira (PA)", "Amazônia", "Brasil". */
	name: string;
	/** Its details page ("/" for Brazil). */
	path: string;
	historyId: string;
	filters: { uf?: string; place?: string; biome?: string };
};

/** A region key's region, or null for one that doesn't exist. */
export function resolveRegion(key: string): ResolvedRegion | null {
	const ref = parseRegionKey(key);
	if (!ref) return null;
	const base = { key: regionKey(ref), kind: ref.kind };
	switch (ref.kind) {
		case "country":
			return {
				...base,
				name: "Brasil",
				path: "/",
				historyId: BRAZIL_ID,
				filters: {},
			};
		case "state":
			return {
				...base,
				name: STATE_NAMES[ref.uf] ?? ref.uf,
				path: statePath(ref.uf),
				historyId: ref.uf,
				filters: { uf: ref.uf },
			};
		case "city": {
			const m = municipalities.find(ref.uf, ref.slug);
			if (!m) return null;
			const label = placeLabel(m.name, m.uf);
			return {
				...base,
				name: label,
				path: municipalityPath(m.uf, m.name),
				historyId: String(m.id),
				filters: { uf: m.uf, place: label },
			};
		}
		case "biome": {
			const b = biomeBySlug(ref.slug);
			if (!b) return null;
			return {
				...base,
				name: b.name,
				path: biomePath(b.slug),
				historyId: biomeHistoryId(b.slug),
				filters: { biome: b.name },
			};
		}
	}
}
