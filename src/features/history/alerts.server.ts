import { getDb } from "~/lib/db.server";
import { ALERTS_COLLECTION, type Alert, AlertSchema } from "./alerts";

/** The newest alerts, or null when the database can't be reached. */
export async function loadAlerts(limit = 50): Promise<Alert[] | null> {
	try {
		const db = await getDb();
		const docs = await db
			.collection<{ _id: string }>(ALERTS_COLLECTION)
			.find({})
			.sort({ createdAt: -1, date: -1, _id: 1 })
			.limit(limit)
			.toArray();
		return docs.flatMap((d) => {
			const parsed = AlertSchema.safeParse(d);
			return parsed.success ? [parsed.data] : [];
		});
	} catch (err) {
		console.warn("alerts unavailable:", String(err));
		return null;
	}
}
