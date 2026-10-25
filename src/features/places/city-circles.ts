/**
 * The state page's city map: one circle per city with detections this year,
 * area proportional to its count (sqrt radius), coloured by how far it is
 * from its own average (`anomalyStep`). Pure, so it can be tested.
 */
import { anomalyStep } from "../history/build";
import type { Ytd } from "../history/schemas";

export type CityCircle = {
	x: number;
	y: number;
	r: number;
	/** Diverging step, -2…2 (see anomalyStep). */
	step: number;
	name: string;
	slug: string;
	current: number;
	ratio: number | null;
};

/** At most this many circles (the cities with most detections), to keep the page small. */
export const MAX_CIRCLES = 250;

/** The biggest circle's radius, in map units. */
export const MAX_RADIUS = 18;

export function cityCircles(
	cities: { id: number; name: string; slug: string }[],
	ytds: Map<number, Ytd>,
	centroid: (id: number) => [number, number] | undefined,
	project: (lon: number, lat: number) => [number, number],
): CityCircle[] {
	const rows = cities.flatMap((c) => {
		const ytd = ytds.get(c.id);
		const at = centroid(c.id);
		return ytd && at && ytd.current > 0 ? [{ c, ytd, at }] : [];
	});
	const max = Math.max(1, ...rows.map((r) => r.ytd.current));
	return (
		rows
			.map(({ c, ytd, at }) => {
				const [x, y] = project(at[0], at[1]);
				return {
					x: Math.round(x * 10) / 10,
					y: Math.round(y * 10) / 10,
					r: Math.max(
						1.5,
						Math.round(Math.sqrt(ytd.current / max) * MAX_RADIUS * 10) / 10,
					),
					step: anomalyStep(ytd.ratio),
					name: c.name,
					slug: c.slug,
					current: ytd.current,
					ratio: ytd.ratio,
				};
			})
			// Biggest first, so small circles draw on top and stay hoverable.
			.sort((a, b) => b.current - a.current)
			.slice(0, MAX_CIRCLES)
	);
}
