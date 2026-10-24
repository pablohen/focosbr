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
		days,
		daysSince:
			firstStored && firstStored > (days[0]?.key ?? "") ? firstStored : null,
	};
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
