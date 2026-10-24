import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmbedCard, embedHead } from "~/features/places/components/EmbedCard";
import { getEmbed } from "~/features/places/regions.functions";

/** A biome's embeddable widget: /embed/biomes/amazonia. */
export const Route = createFileRoute("/embed/biomes/$biome")({
	loader: async ({ params }) => {
		const embed = await getEmbed({ data: { biome: params.biome, h: 24 } });
		if (!embed) throw notFound();
		return embed;
	},
	head: ({ loaderData }) => embedHead(loaderData),
	component: () => <EmbedCard embed={Route.useLoaderData()} />,
});
