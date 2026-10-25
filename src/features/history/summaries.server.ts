import { getDb } from "~/lib/db.server";
import {
	SUMMARIES_COLLECTION,
	type WeekSummary,
	WeekSummarySchema,
	type YearSummary,
	YearSummarySchema,
} from "./schemas";

async function loadSummary<T>(
	id: string,
	parse: (doc: unknown) => T,
): Promise<T | null> {
	try {
		const db = await getDb();
		const doc = await db
			.collection<{ _id: string }>(SUMMARIES_COLLECTION)
			.findOne({ _id: id });
		return doc ? parse(doc) : null;
	} catch (err) {
		console.warn(`summary ${id} unavailable:`, String(err));
		return null;
	}
}

/** The last 7 closed days' summary, or null without one. */
export const loadWeek = (): Promise<WeekSummary | null> =>
	loadSummary("week", (d) => WeekSummarySchema.parse(d));

/** One year's summary, or null without one. */
export const loadYear = (year: number): Promise<YearSummary | null> =>
	loadSummary(`year/${year}`, (d) => YearSummarySchema.parse(d));
