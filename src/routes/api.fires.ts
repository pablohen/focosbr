import { createFileRoute } from "@tanstack/react-router";
import { WindowSchema } from "~/features/fires/schemas";

/**
 * GET /api/fires?h=6|24|48: hotspots for the window, as JSON. A plain route
 * instead of a server function so the CDN can cache it: every visitor in the
 * same five minutes gets the same response.
 */
export const Route = createFileRoute("/api/fires")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const hours = WindowSchema.safeParse(
					Number(new URL(request.url).searchParams.get("h") ?? 24),
				);
				if (!hours.success)
					return Response.json(
						{ error: "h must be 6, 24 or 48" },
						{ status: 400 },
					);
				// Loaded lazily so server-only code stays out of the client graph.
				const { getFires } = await import("~/features/fires/fires.server");
				try {
					return Response.json(await getFires(hours.data), {
						headers: {
							"Cache-Control":
								"public, max-age=60, s-maxage=300, stale-while-revalidate=600",
						},
					});
				} catch (err) {
					console.error("fires fetch failed:", err);
					return Response.json({ error: "INPE indisponível" }, { status: 502 });
				}
			},
		},
	},
});
