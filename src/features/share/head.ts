import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { absoluteUrl } from "~/lib/site";
import { CARD_HEIGHT, CARD_WIDTH, type CardView, cardPath } from "./card";

/**
 * `<head>` for a map page: title, description, canonical URL (the page
 * without its query) and the share card for the view.
 */
export function pageHead({
	title,
	description,
	path,
	view,
	alt,
}: {
	title: string;
	description: string;
	/** The page's path, e.g. "/states/pa". */
	path: string;
	view: CardView;
	/** What the share card shows, for its alt text. */
	alt: string;
}) {
	const image = absoluteUrl(cardPath(view));
	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: absoluteUrl(path) },
			{ property: "og:image", content: image },
			{ property: "og:image:width", content: String(CARD_WIDTH) },
			{ property: "og:image:height", content: String(CARD_HEIGHT) },
			{
				property: "og:image:alt",
				content: `Mapa e número estimado de fogos: ${alt}`,
			},
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:image", content: image },
		],
		links: [
			{ rel: "stylesheet", href: maplibreCss },
			{ rel: "canonical", href: absoluteUrl(path) },
		],
	};
}
