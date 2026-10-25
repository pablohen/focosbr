import { getDb } from "~/lib/db.server";
import { upcomingDays } from "./risk";
import { FORECAST_COLLECTION, ForecastDocSchema } from "./schemas";

/** Today in Brasília ("2026-10-25"). */
const today = () =>
	new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * A region's fire-risk forecast for its page: the issue day and the days
 * from today on (none when INPE's latest forecast is older than that).
 * Null when there's no forecast or the database can't be reached.
 */
export async function loadForecast(id: string) {
	try {
		const db = await getDb();
		const doc = await db
			.collection<{ _id: string }>(FORECAST_COLLECTION)
			.findOne({ _id: id });
		if (!doc) return null;
		const parsed = ForecastDocSchema.parse(doc);
		return { issued: parsed.issued, days: upcomingDays(parsed.days, today()) };
	} catch (err) {
		console.warn(`forecast unavailable for ${id}:`, String(err));
		return null;
	}
}
