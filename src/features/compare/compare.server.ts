import { getFires } from "../fires/fires.server";
import { estimateFires, selectFires } from "../fires/view";
import { loadRegionHistory } from "../history/history.server";
import { resolveRegion } from "../places/resolve.server";
import type { Slots } from "./slots";

/**
 * Each slot's place for /compare: name, page, the last 24 hours, and its
 * year to date and season curve (null when history is unavailable). An
 * empty or unknown slot stays null, so colours keep to their slots.
 */
export async function compareRegions(slots: Slots) {
	const data = await getFires(24);
	return Promise.all(
		slots.map(async (key) => {
			const region = key ? resolveRegion(key) : null;
			if (!region) return null;
			const history = await loadRegionHistory(region.historyId);
			const indices = selectFires(data, region.filters);
			return {
				key: region.key,
				kind: region.kind,
				name: region.name,
				path: region.path,
				fires: estimateFires(data, indices),
				total: indices.length,
				ytd: history?.ytd ?? null,
				season: history?.season ?? null,
			};
		}),
	);
}
