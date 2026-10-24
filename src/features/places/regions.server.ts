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
import { loadRegionHistory } from "../history/history.server";
import { BRAZIL_ID } from "../history/schemas";
import {
	cardBounds,
	dotsPath,
	type Outlines,
	outlinePath,
	projector,
} from "../share/card-map";
import { BIOMES, biomeBySlug, biomeHistoryId, biomePath } from "./biomes";
import {
	isState,
	municipalityPath,
	placeLabel,
	type RegionCount,
	splitPlaceLabel,
	statePath,
} from "./places";
import { municipalities } from "./places.server";

/** The details map's size, in SVG units; the page scales it. */
export const DETAILS_MAP = { width: 640, height: 480 } as const;
/** More dots than this add weight to the page without adding information. */
const MAX_DOTS = 2000;

let outlines: Outlines | undefined;

function counts(
	data: FiresResponse,
	filters: { uf?: string; place?: string; biome?: string },
) {
	const indices = selectFires(data, filters);
	return { fires: estimateFires(data, indices), total: indices.length };
}

/** Cities by detections, most first, with their fire estimate. */
function cityRanking(
	data: FiresResponse,
	filters: { uf?: string; biome?: string },
	limit: number,
): RegionCount[] {
	const byPlace = new Map<number, number>();
	for (const i of selectFires(data, filters)) {
		const p = data.fires.place[i] ?? -1;
		if (data.places[p]) byPlace.set(p, (byPlace.get(p) ?? 0) + 1);
	}
	return [...byPlace]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.flatMap(([p]) => {
			const label = data.places[p] ?? "";
			const split = splitPlaceLabel(label);
			return split
				? [{ ...split, ...counts(data, { ...filters, place: label }) }]
				: [];
		});
}

const common = (data: FiresResponse) => ({
	hours: data.hours,
	generatedAt: data.generatedAt,
	latestAt: data.latestAt,
	sourceUpdatedAt: data.sourceUpdatedAt,
});

/**
 * Everything a state's, city's or biome's page shows. `place` narrows a
 * state to one city ("Altamira (PA)"); a biome ("Amazônia") frames all of
 * Brazil, since there are no biome outlines.
 */
function details(
	data: FiresResponse,
	filters: { uf?: string; place?: string; biome?: string },
) {
	const { uf, place } = filters;
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
			// A biome page has no selected state: every outline is context.
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
	const [data, history] = await Promise.all([
		getFires(hours),
		loadRegionHistory(code),
	]);
	return {
		uf: code,
		name: STATE_NAMES[code] ?? code,
		...details(data, { uf: code }),
		cities: cityRanking(data, { uf: code }, 30),
		history,
	};
}

/** A city's page, or null for an unknown one. */
export async function cityDetails(uf: string, slug: string, hours: Window) {
	const m = municipalities.find(uf, slug);
	if (!m) return null;
	const [data, history] = await Promise.all([
		getFires(hours),
		loadRegionHistory(String(m.id)),
	]);
	const label = placeLabel(m.name, m.uf);
	return {
		uf: m.uf,
		stateName: STATE_NAMES[m.uf] ?? m.uf,
		name: m.name,
		label,
		...details(data, { uf: m.uf, place: label }),
		history,
	};
}

/** Brazil's numbers and every state's, most detections first (home page, /states). */
export async function statesSummary(hours: Window) {
	const [data, history] = await Promise.all([
		getFires(hours),
		loadRegionHistory(BRAZIL_ID),
	]);
	const states = Object.entries(STATE_NAMES)
		.map(([uf, name]) => ({ uf, name, ...counts(data, { uf }) }))
		.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
	return { ...common(data), ...counts(data, {}), states, history };
}

/** A biome's page (by slug, "mata-atlantica"), or null for an unknown one. */
export async function biomeDetails(slug: string, hours: Window) {
	const biome = biomeBySlug(slug);
	if (!biome) return null;
	const [data, history] = await Promise.all([
		getFires(hours),
		loadRegionHistory(biomeHistoryId(biome.slug)),
	]);
	return {
		biome: biome.name,
		slug: biome.slug,
		name: biome.name,
		in: biome.in,
		...details(data, { biome: biome.name }),
		cities: cityRanking(data, { biome: biome.name }, 30),
		history,
	};
}

/** Every biome's numbers, most detections first (/biomes). */
export async function biomesSummary(hours: Window) {
	const data = await getFires(hours);
	const biomes = BIOMES.map((b) => ({
		...b,
		...counts(data, { biome: b.name }),
	})).sort((a, b) => b.total - a.total);
	return { ...common(data), ...counts(data, {}), biomes };
}

/**
 * The embeddable widget's numbers: a region's live counts, and its
 * year-to-date comparison and season curve. Null for an unknown region.
 * With nothing, Brazil.
 */
export async function embedDetails(
	region: { state?: string; city?: string; biome?: string },
	hours: Window,
) {
	let target: {
		name: string;
		path: string;
		historyId: string;
		filters: { uf?: string; place?: string; biome?: string };
	};
	if (region.biome) {
		const b = biomeBySlug(region.biome);
		if (!b) return null;
		target = {
			name: b.name,
			path: biomePath(b.slug),
			historyId: biomeHistoryId(b.slug),
			filters: { biome: b.name },
		};
	} else if (region.state && region.city) {
		const m = municipalities.find(region.state, region.city);
		if (!m) return null;
		const label = placeLabel(m.name, m.uf);
		target = {
			name: label,
			path: municipalityPath(m.uf, m.name),
			historyId: String(m.id),
			filters: { uf: m.uf, place: label },
		};
	} else if (region.state) {
		const uf = region.state.toUpperCase();
		if (!isState(uf)) return null;
		target = {
			name: STATE_NAMES[uf] ?? uf,
			path: statePath(uf),
			historyId: uf,
			filters: { uf },
		};
	} else
		target = { name: "Brasil", path: "/", historyId: BRAZIL_ID, filters: {} };
	const [data, history] = await Promise.all([
		getFires(hours),
		loadRegionHistory(target.historyId),
	]);
	return {
		name: target.name,
		path: target.path,
		...common(data),
		...counts(data, target.filters),
		history: history && { ytd: history.ytd, season: history.season },
	};
}
