/**
 * The compare chart's lines, from each place's season curve: this year
 * (up to yesterday) and the average of past years, either as counts or
 * indexed to the place's own average year (100 = an average year's
 * total), so a city and a state share one axis.
 */
import type { RegionHistory } from "../history/schemas";

type Season = RegionHistory["season"];
export type Point = { day: number; value: number };
export type CompareLine = {
	slot: number;
	name: string;
	current: Point[];
	average: Point[];
};

export function compareLines(
	places: ({ name: string; season: Season | null } | null)[],
	scale: "count" | "index",
): CompareLine[] {
	return places.flatMap((p, slot) => {
		if (!p?.season) return [];
		const s = p.season;
		const base = s.average.at(-1) ?? 0;
		if (scale === "index" && base <= 0) return [];
		const v = (n: number) =>
			scale === "index" ? Math.round((n / base) * 1000) / 10 : n;
		return [
			{
				slot,
				name: p.name,
				current: s.current.points.map((pt) => ({
					day: pt.day,
					value: v(pt.count),
				})),
				average: s.days.map((day, k) => ({ day, value: v(s.average[k] ?? 0) })),
			},
		];
	});
}
