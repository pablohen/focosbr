import { getDb } from "~/lib/db.server";
import { regionSeries } from "./build";
import {
	HISTORY_COLLECTION,
	type RegionHistory,
	RegionHistoryDocSchema,
} from "./schemas";

/**
 * A state's ("PA") or city's (IBGE code) history for its page, or null when
 * it can't be had: no MONGODB_URI, the cluster unreachable, or no document
 * yet. History is extra; the page shows without it rather than failing.
 */
export async function loadRegionHistory(
	id: string,
	now = new Date(),
): Promise<RegionHistory | null> {
	try {
		const db = await getDb();
		const doc = await db
			.collection<{ _id: string }>(HISTORY_COLLECTION)
			.findOne(
				{ _id: id },
				{ projection: { months: 1, days: 1, kind: 1, updatedAt: 1 } },
			);
		if (!doc) {
			// A city with no detection since 2003 has no document: all zeros.
			return regionSeries({ months: {}, days: {}, updatedAt: now }, now);
		}
		const parsed = RegionHistoryDocSchema.pick({
			months: true,
			days: true,
			updatedAt: true,
		}).parse(doc);
		return regionSeries(parsed, now);
	} catch (err) {
		console.warn(`history unavailable for ${id}:`, String(err));
		return null;
	}
}
