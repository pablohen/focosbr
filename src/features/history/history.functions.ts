import { createServerFn } from "@tanstack/react-start";

/** Server functions for the history pages; safe to import from routes. */
export const getRankings = createServerFn({ method: "GET" }).handler(
	async () => {
		const { loadRankings } = await import("./rankings.server");
		return loadRankings();
	},
);
