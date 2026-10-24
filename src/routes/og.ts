import { createFileRoute } from "@tanstack/react-router";
import { cardViewFrom } from "~/features/share/card";

/**
 * GET /og?h=…&uf=…: the share image for a view (see card.server.tsx). The
 * numbers move with INPE's data, so the CDN keeps a card for 10 minutes and
 * serves a stale one for an hour while it renders the next.
 */
export const Route = createFileRoute("/og")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				// Loaded lazily: satori, resvg and the fonts stay out of other routes.
				const { fireCard } = await import("~/features/share/card.server");
				try {
					const png = await fireCard(
						cardViewFrom(new URL(request.url).searchParams),
					);
					return new Response(png, {
						headers: {
							"Content-Type": "image/png",
							"Cache-Control":
								"public, max-age=600, s-maxage=600, stale-while-revalidate=3600",
						},
					});
				} catch (err) {
					console.error("share card failed:", err);
					return new Response("Card unavailable", { status: 502 });
				}
			},
		},
	},
});
