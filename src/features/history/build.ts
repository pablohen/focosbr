/**
 * History aggregation and shaping. Pure (no network, no database), so it
 * can be tested; scripts/history.ts feeds it INPE's files and writes the
 * result to MongoDB, and the pages read it back through `regionSeries`.
 */
import {
	BRAZIL_ID,
	DAYS_SHOWN,
	FIRST_YEAR,
	MONTHS_SHOWN,
	type RegionHistory,
} from "./schemas";

/** Brazil has kept UTC−3 all year since 2019; older DST shifts are ignored. */
const BRASILIA_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;

/** "2026-10" and "2026-10-23" for a UTC instant, in Brasília time. */
export function localKeys(ms: number) {
	const iso = new Date(ms + BRASILIA_MS).toISOString();
	return { month: iso.slice(0, 7), day: iso.slice(0, 10) };
}

/**
 * Reference: a detection from the reference satellite (yearly and monthly
 * files), counted by month. Daily: a detection from any satellite (monthly
 * or daily files), counted by day.
 */
export type HistoryDetection = {
	kind: "reference" | "daily";
	/** Unix milliseconds. */
	time: number;
	uf: string;
	/** IBGE municipality code, when known. */
	cityId?: number;
};

export type RegionCounts = {
	id: string;
	kind: "country" | "state" | "city";
	uf?: string;
	cityId?: number;
	months: Map<string, number>;
	/** Reference-satellite detections by day, for same-period comparisons. */
	refDays: Map<string, number>;
	days: Map<string, number>;
};

/** Counts per region (Brazil, each state, each city) by month and by day. */
export function createHistoryAggregator() {
	const regions = new Map<string, RegionCounts>();
	const region = (
		id: string,
		kind: RegionCounts["kind"],
		uf?: string,
		cityId?: number,
	) => {
		let r = regions.get(id);
		if (!r) {
			r = {
				id,
				kind,
				uf,
				cityId,
				months: new Map(),
				refDays: new Map(),
				days: new Map(),
			};
			regions.set(id, r);
		}
		return r;
	};
	const bump = (m: Map<string, number>, k: string) =>
		m.set(k, (m.get(k) ?? 0) + 1);

	return {
		add(d: HistoryDetection) {
			const { month, day } = localKeys(d.time);
			const targets = [
				region(BRAZIL_ID, "country"),
				region(d.uf, "state", d.uf),
			];
			if (d.cityId !== undefined)
				targets.push(region(String(d.cityId), "city", d.uf, d.cityId));
			for (const r of targets)
				if (d.kind === "reference") {
					bump(r.months, month);
					bump(r.refDays, day);
				} else bump(r.days, day);
		},
		regions: () => [...regions.values()],
	};
}

/**
 * Each year's reference-satellite count from 1 January up to the same day
 * of the year as yesterday (today is still counting in every year), and how
 * this year compares with the average of the previous years.
 */
export function ytdSummary(refDays: Record<string, number>, now: Date) {
	const through = localKeys(now.getTime() - DAY_MS).day;
	const thisYear = Number(through.slice(0, 4));
	const cut = through.slice(5);
	const byYear = new Map<number, number>();
	for (const [day, n] of Object.entries(refDays)) {
		if (day.slice(5) > cut) continue;
		const y = Number(day.slice(0, 4));
		byYear.set(y, (byYear.get(y) ?? 0) + n);
	}
	const years = [];
	for (let y = FIRST_YEAR; y <= thisYear; y++)
		years.push({ year: y, count: byYear.get(y) ?? 0 });
	const past = years.slice(0, -1);
	const average = past.length
		? past.reduce((a, y) => a + y.count, 0) / past.length
		: 0;
	const record = past.reduce<{ year: number; count: number } | null>(
		(a, y) => (y.count > (a?.count ?? 0) ? y : a),
		null,
	);
	const current = byYear.get(thisYear) ?? 0;
	return {
		/** Last day counted, "2026-10-23"; the same day of the year in every year. */
		through,
		current,
		average: Math.round(average * 10) / 10,
		/** This year over the average; null when the average is zero. */
		ratio: average > 0 ? Math.round((current / average) * 1000) / 1000 : null,
		record,
		years,
	};
}

/** Day of the year (1–365) of a "MM-DD", on a non-leap year (29 February reads as 1 March). */
export function dayOfYear(md: string) {
	const [m = 1, d = 1] = md.split("-").map(Number);
	return (Date.UTC(2025, m - 1, d) - Date.UTC(2025, 0, 1)) / DAY_MS + 1;
}

/** "MM-DD" of a day of the year on a non-leap year. */
const monthDay = (doy: number) =>
	new Date(Date.UTC(2025, 0, doy)).toISOString().slice(5, 10);

/** The season curve's sample days: every 7th day of the year, and 31 December. */
const SEASON_DAYS = [...Array.from({ length: 52 }, (_, k) => (k + 1) * 7), 365];

/**
 * The fire-season tracker: reference-satellite detections summed from
 * 1 January, sampled weekly, for this year (up to yesterday, the last
 * closed day) against the range, average and record of every past year
 * since FIRST_YEAR. Years are cut by month-day, so they line up.
 */
export function seasonCurve(refDays: Record<string, number>, now: Date) {
	const through = localKeys(now.getTime() - DAY_MS).day;
	const thisYear = Number(through.slice(0, 4));
	const byYear = new Map<number, [string, number][]>();
	for (const [day, n] of Object.entries(refDays)) {
		const y = Number(day.slice(0, 4));
		if (y > thisYear || (y === thisYear && day > through)) continue;
		const list = byYear.get(y) ?? [];
		list.push([day.slice(5), n]);
		byYear.set(y, list);
	}
	/** Running totals of a year at each of `marks` ("MM-DD", ascending). */
	const cumulative = (year: number, marks: string[]) => {
		const list = (byYear.get(year) ?? []).sort((a, b) =>
			a[0] < b[0] ? -1 : 1,
		);
		let i = 0;
		let sum = 0;
		return marks.map((md) => {
			for (; i < list.length && (list[i]?.[0] ?? "") <= md; i++)
				sum += list[i]?.[1] ?? 0;
			return sum;
		});
	};
	const marks = SEASON_DAYS.map(monthDay);
	const past: { year: number; values: number[] }[] = [];
	for (let y = FIRST_YEAR; y < thisYear; y++)
		past.push({ year: y, values: cumulative(y, marks) });
	const at = (k: number) => past.map((p) => p.values[k] ?? 0);
	const record = past.reduce<(typeof past)[number] | null>(
		(a, p) => ((p.values.at(-1) ?? 0) > (a?.values.at(-1) ?? 0) ? p : a),
		null,
	);
	const throughDay = dayOfYear(through.slice(5));
	const currentDays = [
		...SEASON_DAYS.filter((d) => d < throughDay),
		throughDay,
	];
	const currentValues = cumulative(thisYear, currentDays.map(monthDay));
	return {
		through,
		days: SEASON_DAYS,
		min: SEASON_DAYS.map((_, k) => (past.length ? Math.min(...at(k)) : 0)),
		max: SEASON_DAYS.map((_, k) => (past.length ? Math.max(...at(k)) : 0)),
		average: SEASON_DAYS.map((_, k) =>
			past.length
				? Math.round(at(k).reduce((a, b) => a + b, 0) / past.length)
				: 0,
		),
		record: record && (record.values.at(-1) ?? 0) > 0 ? record : null,
		current: {
			year: thisYear,
			points: currentDays.map((day, k) => ({
				day,
				count: currentValues[k] ?? 0,
			})),
		},
	};
}

/**
 * A region's page series from its stored maps: every year since FIRST_YEAR
 * (summed from months), the last MONTHS_SHOWN months and DAYS_SHOWN days.
 * Missing entries are zeros; the current year, month and day are partial.
 */
export function regionSeries(
	stored: {
		months: Record<string, number>;
		refDays: Record<string, number>;
		days: Record<string, number>;
		updatedAt: Date;
	},
	now: Date,
): RegionHistory {
	const today = localKeys(now.getTime());
	const thisYear = Number(today.month.slice(0, 4));
	const byYear = new Map<number, number>();
	for (const [month, n] of Object.entries(stored.months)) {
		const y = Number(month.slice(0, 4));
		byYear.set(y, (byYear.get(y) ?? 0) + n);
	}
	const years = [];
	for (let y = FIRST_YEAR; y <= thisYear; y++)
		years.push({
			key: String(y),
			count: byYear.get(y) ?? 0,
			partial: y === thisYear,
		});

	const [ty = 0, tm = 1] = today.month.split("-").map(Number);
	const months = Array.from({ length: MONTHS_SHOWN }, (_, k) => {
		const d = new Date(Date.UTC(ty, tm - 1 - (MONTHS_SHOWN - 1 - k)));
		const key = d.toISOString().slice(0, 7);
		return {
			key,
			count: stored.months[key] ?? 0,
			partial: key === today.month,
		};
	});

	const todayMs = Date.parse(`${today.day}T00:00:00Z`);
	const days = Array.from({ length: DAYS_SHOWN }, (_, k) => {
		const key = new Date(todayMs - (DAYS_SHOWN - 1 - k) * DAY_MS)
			.toISOString()
			.slice(0, 10);
		return { key, count: stored.days[key] ?? 0, partial: key === today.day };
	});
	// Day counts start in 2023 (INPE's monthly files); say so if that's
	// later than the first day shown.
	const firstStored = Object.keys(stored.days).sort()[0] ?? null;
	// Month × year grid for the fire-season calendar, oldest year first.
	const calendar = years.map((y) => ({
		year: Number(y.key),
		months: Array.from(
			{ length: 12 },
			(_, m) =>
				stored.months[`${y.key}-${String(m + 1).padStart(2, "0")}`] ?? 0,
		),
	}));
	return {
		updatedAt: stored.updatedAt.toISOString(),
		years,
		months,
		calendar,
		ytd: ytdSummary(stored.refDays, now),
		season: seasonCurve(stored.refDays, now),
		days,
		daysSince:
			firstStored && firstStored > (days[0]?.key ?? "") ? firstStored : null,
	};
}

/** Steps of the fire-season calendar's colour ramp (`--cal-1`…`--cal-5`). */
export const CALENDAR_STEPS = 5;

/**
 * A month's step on the calendar's ramp: 0 for none, then 1…CALENDAR_STEPS
 * on a square-root scale of the region's busiest month, so quiet months
 * still show against a peak season dozens of times bigger.
 */
export function calendarStep(count: number, max: number) {
	if (count <= 0 || max <= 0) return 0;
	return (
		1 +
		Math.min(
			CALENDAR_STEPS - 1,
			Math.floor(Math.sqrt(count / max) * CALENDAR_STEPS),
		)
	);
}

/**
 * INPE's yearly files name municipalities as they were; a few have been
 * renamed since. Keys are "UF/slug of INPE's name", values IBGE's names.
 */
export const RENAMED: Record<string, string> = {
	"MT/santo-antonio-do-leverger": "Santo Antônio de Leverger",
	"TO/fortaleza-do-tabocao": "Tabocão",
	"RR/sao-luiz": "São Luiz do Anauá",
	"SE/gracho-cardoso": "Graccho Cardoso",
	"RN/augusto-severo": "Campo Grande",
	"RN/acu": "Assú",
	"RN/ares": "Arez",
};
