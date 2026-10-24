import { createServerFn } from "@tanstack/react-start";

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
