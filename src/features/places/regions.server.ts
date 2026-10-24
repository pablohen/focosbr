/**
 * What the region pages show, computed from the same cached INPE data as
 * `/api/fires` and rendered on the server: numbers, the hourly profile, the
 * biggest fires, breakdowns and a small map. The page's HTML carries all of
 * it (for readers, search engines and link previews) without the browser
 * downloading the whole payload.
 */
import outlinesText from "../../../public/data/state-outlines.geojson?raw";
import { getFires } from "../fires/fires.server";
import type { FiresResponse, Window } from "../fires/schemas";
import { STATE_NAMES } from "../fires/states";
import {
	AGE_BANDS,
	estimateFires,
	hourlyCounts,
	riskClass,
	SENSOR_LABELS,
	selectFires,
	summarize,
	topFires,
} from "../fires/view";
import {
	cardBounds,
	dotsPath,
	type Outlines,
	outlinePath,
	projector,
} from "../share/card-map";
import {
	isState,
	placeLabel,
	type RegionCount,
	splitPlaceLabel,
} from "./places";
import { municipalities } from "./places.server";

/** The details map's size, in SVG units; the page scales it. */
export const DETAILS_MAP = { width: 640, height: 480 } as const;
/** More dots than this add weight to the page without adding information. */
const MAX_DOTS = 2000;

let outlines: Outlines | undefined;

function counts(data: FiresResponse, filters: { uf?: string; place?: string }) {
	const indices = selectFires(data, filters);
	return { fires: estimateFires(data, indices), total: indices.length };
}

/** Cities by detections, most first, with their fire estimate. */
function cityRanking(
	data: FiresResponse,
	uf: string | undefined,
	limit: number,
): RegionCount[] {
	const byPlace = new Map<number, number>();
	for (const i of selectFires(data, { uf })) {
		const p = data.fires.place[i] ?? -1;
		if (data.places[p]) byPlace.set(p, (byPlace.get(p) ?? 0) + 1);
	}
	return [...byPlace]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.flatMap(([p]) => {
			const label = data.places[p] ?? "";
			const split = splitPlaceLabel(label);
			return split ? [{ ...split, ...counts(data, { place: label }) }] : [];
		});
}

const common = (data: FiresResponse) => ({
	hours: data.hours,
	generatedAt: data.generatedAt,
	latestAt: data.latestAt,
	sourceUpdatedAt: data.sourceUpdatedAt,
});

/**
 * Everything a state's or city's page shows. `place` narrows a state to one
 * city ("Altamira (PA)").
 */
function details(data: FiresResponse, uf: string, place?: string) {
	const filters = { uf, place };
	const indices = selectFires(data, filters);
	const summary = summarize(data, filters);
	const nowMs = Date.parse(data.generatedAt);

	// The map frames the state. The region's detections are coloured by age;
	// on a city page, the rest of the state's are drawn faintly for context.
	outlines ??= JSON.parse(outlinesText) as Outlines;
	const project = projector(
		cardBounds(outlines, uf),
		DETAILS_MAP.width,
		DETAILS_MAP.height,
	);
	const bandOf = (i: number) => {
		const age = (nowMs / 1000 - (data.fires.t[i] ?? 0)) / 3600;
		const k = AGE_BANDS.findIndex((b) => age < b.maxHours);
		return k < 0 ? AGE_BANDS.length - 1 : k;
	};
	const xy = (i: number) =>
		project(data.fires.lon[i] ?? 0, data.fires.lat[i] ?? 0);
	// One path per age band, oldest band first so the newest draw on top.
	const shown = indices.slice(-MAX_DOTS);
	const bands = AGE_BANDS.map((_, k) =>
		dotsPath(shown.filter((i) => bandOf(i) === k).map(xy)),
	).reverse();
	const context = place
		? selectFires(data, { uf }).filter(
				(i) => data.places[data.fires.place[i] ?? -1] !== place,
			)
		: [];

	// INPE's weather, for the detections from closed days that have it.
	const risks = indices
		.map((i) => data.fires.risk[i])
		.filter((r): r is number => r != null);
	const dryDays = indices
		.map((i) => data.fires.dry[i])
		.filter((d): d is number => d != null)
		.sort((a, b) => a - b);
	const riskClasses = new Map<string, number>();
	for (const r of risks)
		riskClasses.set(riskClass(r), (riskClasses.get(riskClass(r)) ?? 0) + 1);

	return {
		...common(data),
		fires: summary.fires,
		total: summary.total,
		preliminary: summary.preliminary,
		hourly: hourlyCounts(data, indices, data.hours, nowMs),
		topFires: topFires(data, summary.groups, "count", 8).map((f) => ({
			id: f.id,
			place: f.place,
			count: f.count,
			totalFrp: f.totalFrp,
			first: f.first.toISOString(),
			last: f.last.toISOString(),
			bounds: f.bounds,
		})),
		biomes: summary.biomes
			.filter((b) => b.name)
			.map((b) => ({ name: b.name, count: b.count })),
		sensors: [...summary.bySensor]
			.sort((a, b) => b[1] - a[1])
			.map(([s, count]) => ({ name: SENSOR_LABELS[s], count })),
		weather: risks.length
			? {
					known: risks.length,
					medianDryDays: dryDays[Math.floor(dryDays.length / 2)] ?? null,
					riskClasses: [...riskClasses]
						.sort((a, b) => b[1] - a[1])
						.map(([name, count]) => ({ name, count })),
				}
			: null,
		map: {
			...DETAILS_MAP,
			states: outlinePath(outlines, project, (s) => s !== uf, 2, DETAILS_MAP),
			selected: outlinePath(outlines, project, (s) => s === uf, 1.5),
			context: dotsPath(context.slice(-MAX_DOTS).map(xy)),
			all: dotsPath(shown.map(xy)),
			/** Oldest age band first, so the newest draw on top. */
			bands,
		},
	};
}

/** A state's page, or null for an unknown state. */
export async function stateDetails(uf: string, hours: Window) {
	const code = uf.toUpperCase();
	if (!isState(code)) return null;
	const data = await getFires(hours);
	return {
		uf: code,
		name: STATE_NAMES[code] ?? code,
		...details(data, code),
		cities: cityRanking(data, code, 30),
	};
}

/** A city's page, or null for an unknown one. */
export async function cityDetails(uf: string, slug: string, hours: Window) {
	const m = municipalities.find(uf, slug);
	if (!m) return null;
	const data = await getFires(hours);
	const label = placeLabel(m.name, m.uf);
	return {
		uf: m.uf,
		stateName: STATE_NAMES[m.uf] ?? m.uf,
		name: m.name,
		label,
		...details(data, m.uf, label),
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
