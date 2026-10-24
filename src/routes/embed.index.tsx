import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmbedCard, embedHead } from "~/features/places/components/EmbedCard";
import { getEmbed } from "~/features/places/regions.functions";

/** Brazil's embeddable widget: /embed. */
export const Route = createFileRoute("/embed/")({
	loader: async () => {
		const embed = await getEmbed({ data: { h: 24 } });
		if (!embed) throw notFound();
		return embed;
	},
	head: ({ loaderData }) => embedHead(loaderData),
	component: () => <EmbedCard embed={Route.useLoaderData()} />,
});
