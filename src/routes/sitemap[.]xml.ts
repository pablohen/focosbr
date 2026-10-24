import { createFileRoute } from "@tanstack/react-router";
import { sitemapPaths, sitemapXml } from "~/features/places/sitemap";
import { absoluteUrl } from "~/lib/site";

/** GET /sitemap.xml: the home page, /states, every state and every city. */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				// Loaded lazily: the municipality list stays out of other routes.
				const { municipalities } = await import(
					"~/features/places/places.server"
				);
				const xml = sitemapXml(
					sitemapPaths(municipalities.all()).map(absoluteUrl),
				);
				return new Response(xml, {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control": "public, max-age=3600, s-maxage=86400",
					},
				});
			},
		},
	},
});
