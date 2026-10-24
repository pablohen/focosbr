import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "~/lib/site";

/** Public data: any site may read it from the browser. */
const OPEN = { "Access-Control-Allow-Origin": "*" };

/**
 * GET /api/history/<key>: a region's history as JSON (the series the pages
 * draw), for "br", "pa", "pa/altamira" or "biome/amazonia". History moves
 * once a day, so the CDN keeps it for an hour.
 */
export const Route = createFileRoute("/api/history/$")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { resolveRegion } = await import(
					"~/features/places/resolve.server"
				);
				const { loadRegionHistory } = await import(
					"~/features/history/history.server"
				);
				const region = resolveRegion(params._splat ?? "");
				if (!region)
					return Response.json(
						{
							error:
								'Região desconhecida. Use "br", uma UF ("pa"), "uf/município" ("pa/altamira") ou "biome/<bioma>" ("biome/amazonia").',
						},
						{ status: 404, headers: OPEN },
					);
				const history = await loadRegionHistory(region.historyId);
				if (!history)
					return Response.json(
						{ error: "Histórico indisponível no momento." },
						{ status: 503, headers: { ...OPEN, "Retry-After": "300" } },
					);
				return Response.json(
					{
						region: {
							key: region.key,
							kind: region.kind,
							name: region.name,
							page: absoluteUrl(region.path),
						},
						attribution:
							"Focos de calor: INPE, Programa Queimadas (https://terrabrasilis.dpi.inpe.br/queimadas/portal/). Processado por FocosBR.",
						notes: {
							years:
								"Satélite de referência do INPE (AQUA, passagem da tarde), comparável entre anos; o ano atual é parcial.",
							days: "Todos os satélites, como o mapa.",
							timeZone: "Datas no horário de Brasília (UTC−3).",
						},
						history,
					},
					{
						headers: {
							...OPEN,
							"Cache-Control":
								"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
						},
					},
				);
			},
		},
	},
});
