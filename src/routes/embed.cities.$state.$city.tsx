import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmbedCard, embedHead } from "~/features/places/components/EmbedCard";
import { getEmbed } from "~/features/places/regions.functions";

/** A city's embeddable widget: /embed/cities/pa/altamira. */
export const Route = createFileRoute("/embed/cities/$state/$city")({
	loader: async ({ params }) => {
		const embed = await getEmbed({
			data: { state: params.state, city: params.city, h: 24 },
		});
		if (!embed) throw notFound();
		return embed;
	},
	head: ({ loaderData }) => embedHead(loaderData),
	component: () => <EmbedCard embed={Route.useLoaderData()} />,
});
