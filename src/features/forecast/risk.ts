/**
 * Region summaries of INPE's fire-risk forecast rasters, and which days to
 * show. Pure, so they can be tested.
 */
import { type ForecastDay, HIGH_RISK } from "./schemas";

/** INPE's no-data value in the risk rasters. */
export const NO_DATA = -999;

/** Mean risk and the share at high risk over a region's sampled values; null with none. */
export function summarizeRisk(
	values: Iterable<number>,
): { mean: number; high: number } | null {
	let n = 0;
	let sum = 0;
	let high = 0;
	for (const v of values) {
		if (v === NO_DATA || !Number.isFinite(v) || v < 0) continue;
		n++;
		sum += Math.min(v, 1);
		if (v >= HIGH_RISK) high++;
	}
	if (!n) return null;
	const round = (x: number) => Math.round(x * 100) / 100;
	return { mean: round(sum / n), high: round(high / n) };
}

/** The forecast days from `today` on: a late or stale forecast never shows days already past. */
export function upcomingDays(
	days: ForecastDay[],
	today: string,
): ForecastDay[] {
	return days.filter((d) => d.date >= today);
}

/** The day `offset` days after `day` ("2026-10-23", 2 → "2026-10-25"). */
export function addDays(day: string, offset: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000)
		.toISOString()
		.slice(0, 10);
}
