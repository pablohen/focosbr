import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmbedCard, embedHead } from "~/features/places/components/EmbedCard";
import { getEmbed } from "~/features/places/regions.functions";

/** A state's embeddable widget: /embed/states/pa. */
export const Route = createFileRoute("/embed/states/$state")({
	loader: async ({ params }) => {
		const embed = await getEmbed({ data: { state: params.state, h: 24 } });
		if (!embed) throw notFound();
		return embed;
	},
	head: ({ loaderData }) => embedHead(loaderData),
	component: () => <EmbedCard embed={Route.useLoaderData()} />,
});
