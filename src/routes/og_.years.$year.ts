import { createFileRoute } from "@tanstack/react-router";
import { ytdPeriod } from "~/features/history/format";

/** GET /og/years/2024: a year page's share card. */
export const Route = createFileRoute("/og_/years/$year")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { loadYear } = await import(
					"~/features/history/summaries.server"
				);
				const { summaryCard } = await import("~/features/share/card.server");
				const s = await loadYear(Number(params.year));
				const total = s?.totals.find((t) => t.year === s.year)?.count;
				if (!s || total === undefined)
					return new Response("Card unavailable", { status: 404 });
				const png = await summaryCard({
					label: `Focos de calor em ${s.year}`,
					value: total,
					unit: "focos",
					lines: [
						"satélite de referência do INPE",
						s.partial
							? `de ${ytdPeriod(s.through)} (ano em curso)`
							: "no ano inteiro",
					],
					listTitle: "Estados com mais focos",
					list: s.states.map((r) => ({ name: r.name, value: r.count })),
				});
				return new Response(png, {
					headers: {
						"Content-Type": "image/png",
						"Cache-Control": s.partial
							? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
							: "public, max-age=86400, s-maxage=86400",
					},
				});
			},
		},
	},
});
