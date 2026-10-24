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
	/** The last DAYS_SHOWN days, all satellites; `key` is "2026-10-23". */
	days: z.array(Point),
	/** First day with all-satellite counts, if after the first one shown. */
	daysSince: z.string().nullable(),
});
export type RegionHistory = z.infer<typeof RegionHistorySchema>;
