import { createFileRoute } from "@tanstack/react-router";
import { percentVsAverage, weekLabel } from "~/features/history/format";

/** GET /og/week: the weekly summary's share card, cached like /og. */
export const Route = createFileRoute("/og_/week")({
	server: {
		handlers: {
			GET: async () => {
				const { loadWeek } = await import(
					"~/features/history/summaries.server"
				);
				const { summaryCard } = await import("~/features/share/card.server");
				const week = await loadWeek();
				const brazil = week?.regions.find((r) => r.kind === "country");
				if (!week || !brazil)
					return new Response("Card unavailable", { status: 503 });
				const png = await summaryCard({
					label: `Semana de ${weekLabel(week.from, week.through)}`,
					value: brazil.current,
					unit: "focos",
					lines: [
						"no Brasil, por todos os satélites",
						...(brazil.previous > 0
							? [
									`${percentVsAverage(brazil.current / brazil.previous)} vs. semana anterior`,
								]
							: []),
					],
					listTitle: "Estados com mais focos",
					list: week.regions
						.filter((r) => r.kind === "state")
						.map((r) => ({ name: r.name, value: r.current })),
				});
				return new Response(png, {
					headers: {
						"Content-Type": "image/png",
						"Cache-Control":
							"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
					},
				});
			},
		},
	},
});
