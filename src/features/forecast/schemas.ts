import { z } from "zod";

export const FORECAST_COLLECTION = "forecast";
/** "Alto" and above, by INPE's thresholds (see riskClass). */
export const HIGH_RISK = 0.7;

const ForecastDay = z.object({
	/** "2026-10-26", the day the forecast is for (Brasília). */
	date: z.string(),
	/** Mean fire risk over the region, 0–1. */
	mean: z.number(),
	/** Share of the region at high or critical risk, 0–1. */
	high: z.number(),
});
export type ForecastDay = z.infer<typeof ForecastDay>;

/**
 * INPE's fire-risk forecast for one region (`_id` as in `history`), from
 * its rasters for the issue day and the next three. Written daily by
 * scripts/forecast.ts.
 */
export const ForecastDocSchema = z.object({
	_id: z.string(),
	/** The day INPE issued the forecast. */
	issued: z.string(),
	days: z.array(ForecastDay),
	updatedAt: z.date(),
});
export type ForecastDoc = z.infer<typeof ForecastDocSchema>;
