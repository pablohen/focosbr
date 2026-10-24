import { createFileRoute } from "@tanstack/react-router";
import { alertsRss } from "~/features/history/alerts";
import { FIRST_YEAR } from "~/features/history/schemas";
import { SITE_URL } from "~/lib/site";

/** GET /feed.xml: the alerts as RSS, refreshed by the daily history run. */
export const Route = createFileRoute("/feed.xml")({
	server: {
		handlers: {
			GET: async () => {
				const { loadAlerts } = await import("~/features/history/alerts.server");
				const alerts = await loadAlerts();
				if (!alerts)
					return new Response("Feed unavailable", {
						status: 503,
						headers: { "Retry-After": "300" },
					});
				return new Response(alertsRss(alerts, SITE_URL, FIRST_YEAR), {
					headers: {
						"Content-Type": "application/rss+xml; charset=utf-8",
						"Cache-Control":
							"public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
					},
				});
			},
		},
	},
});
