import { z } from "zod";

/**
 * INPE's reference satellite: AQUA's afternoon pass (MODIS). Its series is
 * the one INPE uses to compare years, since the number of satellites has
 * changed over time and would inflate later years.
 */
export const REFERENCE_SATELLITE = "AQUA_M-T";
/** First year of INPE's yearly reference files. */
export const FIRST_YEAR = 2003;
/** How much of each series the pages show. */
export const MONTHS_SHOWN = 24;
export const DAYS_SHOWN = 90;

export const HISTORY_COLLECTION = "history";
/** `_id` of the whole country's document. */
export const BRAZIL_ID = "BR";

const YearCount = z.object({ year: z.number().int(), count: z.number().int() });

/** This year to date against the same period in past years. */
export const YtdSchema = z.object({
	through: z.string(),
	current: z.number().int(),
	average: z.number(),
	ratio: z.number().nullable(),
	record: YearCount.nullable(),
	years: z.array(YearCount),
});
export type Ytd = z.infer<typeof YtdSchema>;

/**
 * One region's history in MongoDB (`history` collection): `_id` is
 * "BR", a state code ("PA") or an IBGE municipality code ("1500602").
 * Maps are sparse: a missing month or day is zero. Months and days are in
 * Brasília time; the current ones are still counting.
 */
export const RegionHistoryDocSchema = z.object({
	_id: z.string(),
	kind: z.enum(["country", "state", "city"]),
	uf: z.string().optional(),
	cityId: z.number().int().optional(),
	/** Reference-satellite detections by month, "2003-01" → count. */
	months: z.record(z.string(), z.number().int().nonnegative()).default({}),
	/** Reference-satellite detections by day, "2003-01-01" → count. */
	refDays: z.record(z.string(), z.number().int().nonnegative()).default({}),
	/** All satellites' detections by day, "2026-10-23" → count. */
	days: z.record(z.string(), z.number().int().nonnegative()).default({}),
	/** This year to date against the same period of past years (`ytdSummary`), for rankings. */
	ytd: YtdSchema.optional(),
	updatedAt: z.date(),
});
export type RegionHistoryDoc = z.infer<typeof RegionHistoryDocSchema>;

const Point = z.object({
	key: z.string(),
	count: z.number().int(),
	/** Still counting (this year, month or day). */
	partial: z.boolean(),
});

const SeasonSchema = z.object({
	/** Last day counted, "2026-10-23". */
	through: z.string(),
	/** Sample days of the year (1–365) for min, max, average and record. */
	days: z.array(z.number().int()),
	/** Lowest, highest and average running total of past years at each sample day. */
	min: z.array(z.number().int()),
	max: z.array(z.number().int()),
	average: z.array(z.number().int()),
	/** The past year with the most detections, at each sample day. */
	record: z
		.object({ year: z.number().int(), values: z.array(z.number().int()) })
		.nullable(),
	/** This year, weekly and on its last counted day. */
	current: z.object({
		year: z.number().int(),
		points: z.array(
			z.object({ day: z.number().int(), count: z.number().int() }),
		),
	}),
});

/** What a state's or city's page shows. */
export const RegionHistorySchema = z.object({
	updatedAt: z.iso.datetime(),
	/** Since FIRST_YEAR, reference satellite; `key` is "2024". */
	years: z.array(Point),
	/** The last MONTHS_SHOWN months, reference satellite; `key` is "2026-10". */
	months: z.array(Point),
	/** Reference-satellite detections per month, one row per year (fire-season calendar). */
	calendar: z.array(
		z.object({ year: z.number().int(), months: z.array(z.number().int()) }),
	),
	ytd: YtdSchema,
	/** The fire-season tracker (`seasonCurve`): running totals from 1 January, by day of the year. */
	season: SeasonSchema,
	/** The last DAYS_SHOWN days, all satellites; `key` is "2026-10-23". */
	days: z.array(Point),
	/** First day with all-satellite counts, if after the first one shown. */
	daysSince: z.string().nullable(),
});
export type RegionHistory = z.infer<typeof RegionHistorySchema>;

/** Rankings need a city's past to mean something: below this yearly average, a few detections make a huge ratio. */
export const RANKING_MIN_AVERAGE = 50;
/** Rows per city ranking. */
export const RANKING_SIZE = 20;

const RankingRow = z.object({
	/** State code ("PA"); for a city, its state. */
	uf: z.string(),
	/** IBGE's name of the state or city. */
	name: z.string(),
	current: z.number().int(),
	average: z.number(),
	ratio: z.number().nullable(),
});
export type RankingRow = z.infer<typeof RankingRow>;

/** What /rankings shows: this year to date, by state and by city. */
export const RankingsSchema = z.object({
	/** Last day counted, "2026-10-23". */
	through: z.string(),
	firstYear: z.number().int(),
	/** Every state, most detections first. */
	states: z.array(RankingRow),
	/** The RANKING_SIZE cities with most detections. */
	cities: z.array(RankingRow),
	/** The RANKING_SIZE cities furthest above their own average (at least RANKING_MIN_AVERAGE). */
	aboveAverage: z.array(RankingRow),
});
export type Rankings = z.infer<typeof RankingsSchema>;
