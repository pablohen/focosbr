import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Server functions for the history pages; safe to import from routes. */
export const getRankings = createServerFn({ method: "GET" }).handler(
	async () => {
		const { loadRankings } = await import("./rankings.server");
		return loadRankings();
	},
);

/** The newest alerts, with dates as ISO strings for the page. */
export const getAlerts = createServerFn({ method: "GET" }).handler(async () => {
	const { loadAlerts } = await import("./alerts.server");
	const alerts = await loadAlerts();
	return (
		alerts?.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })) ?? null
	);
});

/** The weekly summary, with its date as an ISO string. */
export const getWeek = createServerFn({ method: "GET" }).handler(async () => {
	const { loadWeek } = await import("./summaries.server");
	const week = await loadWeek();
	return week && { ...week, updatedAt: week.updatedAt.toISOString() };
});

/** One year's summary, or null for a year without one. */
export const getYear = createServerFn({ method: "GET" })
	.validator(z.object({ year: z.number().int().min(1990).max(2100) }))
	.handler(async ({ data }) => {
		const { loadYear } = await import("./summaries.server");
		const year = await loadYear(data.year);
		return year && { ...year, updatedAt: year.updatedAt.toISOString() };
	});
