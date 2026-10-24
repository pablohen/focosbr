/**
 * Small summaries for the region pages, computed from the same cached INPE
 * data as `/api/fires`, so the page's title, description and text carry
 * current numbers in the server-rendered HTML (for search engines and link
 * previews) without shipping the whole payload in it.
 */
import { getFires } from "../fires/fires.server";
import type { FiresResponse, Window } from "../fires/schemas";
import { STATE_NAMES } from "../fires/states";
import { estimateFires, selectFires } from "../fires/view";
import {
	isState,
	placeLabel,
	type RegionCount,
	splitPlaceLabel,
} from "./places";
import { municipalities } from "./places.server";

function counts(data: FiresResponse, filters: { uf?: string; place?: string }) {
	const indices = selectFires(data, filters);
	return { fires: estimateFires(data, indices), total: indices.length };
}

/** Municipalities by detections, most first, with their fire estimate. */
function topMunicipalities(
	data: FiresResponse,
	uf: string | undefined,
	limit: number,
) {
	const byPlace = new Map<number, number>();
	selectFires(data, { uf }).forEach((i) => {
		const p = data.fires.place[i] ?? -1;
		if (data.places[p]) byPlace.set(p, (byPlace.get(p) ?? 0) + 1);
	});
	return [...byPlace]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.flatMap(([p]): RegionCount[] => {
			const label = data.places[p] ?? "";
			const split = splitPlaceLabel(label);
			return split ? [{ ...split, ...counts(data, { place: label }) }] : [];
		});
}

const common = (data: FiresResponse) => ({
	hours: data.hours,
	latestAt: data.latestAt,
	sourceUpdatedAt: data.sourceUpdatedAt,
});

/** A state's page summary, or null for an unknown state. */
export async function stateSummary(uf: string, hours: Window) {
	const code = uf.toUpperCase();
	if (!isState(code)) return null;
	const data = await getFires(hours);
	return {
		uf: code,
		name: STATE_NAMES[code] ?? code,
		...common(data),
		...counts(data, { uf: code }),
		municipalities: topMunicipalities(data, code, 10),
	};
}

/** A municipality's page summary, or null for an unknown one. */
export async function municipalitySummary(
	uf: string,
	slug: string,
	hours: Window,
) {
	const m = municipalities.find(uf, slug);
	if (!m) return null;
	const data = await getFires(hours);
	const label = placeLabel(m.name, m.uf);
	return {
		uf: m.uf,
		stateName: STATE_NAMES[m.uf] ?? m.uf,
		name: m.name,
		label,
		...common(data),
		...counts(data, { place: label }),
	};
}

/** Brazil's numbers and every state's, most detections first (home page, /states). */
export async function statesSummary(hours: Window) {
	const data = await getFires(hours);
	const states = Object.entries(STATE_NAMES)
		.map(([uf, name]) => ({ uf, name, ...counts(data, { uf }) }))
		.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
	return { ...common(data), ...counts(data, {}), states };
}
