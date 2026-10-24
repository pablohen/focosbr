import { createFileRoute } from "@tanstack/react-router";
import { alertText } from "~/features/history/alerts";
import { FIRST_YEAR } from "~/features/history/schemas";
import { absoluteUrl } from "~/lib/site";

const OPEN = { "Access-Control-Allow-Origin": "*" };

/** GET /api/alerts: the newest alerts as JSON, worded as on /alerts. */
export const Route = createFileRoute("/api/alerts")({
	server: {
		handlers: {
			GET: async () => {
				const { loadAlerts } = await import("~/features/history/alerts.server");
				const alerts = await loadAlerts();
				if (!alerts)
					return Response.json(
						{ error: "Alertas indisponíveis no momento." },
						{ status: 503, headers: { ...OPEN, "Retry-After": "300" } },
					);
				return Response.json(
					{
						alerts: alerts.map(({ _id, path, createdAt, ...a }) => ({
							id: _id,
							...a,
							...alertText(a, FIRST_YEAR),
							page: absoluteUrl(path),
							createdAt: createdAt.toISOString(),
						})),
					},
					{
						headers: {
							...OPEN,
							"Cache-Control":
								"public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
						},
					},
				);
			},
		},
	},
});
