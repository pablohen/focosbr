import { Container } from "@mantine/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { biomePath } from "~/features/places/biomes";
import { PageHeader } from "~/features/places/components/PageHeader";
import { RegionDetails } from "~/features/places/components/RegionDetails";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { getBiomeDetails } from "~/features/places/regions.functions";
import { pageHead } from "~/features/share/head";

/** A biome's details page: /biomes/amazonia. */
export const Route = createFileRoute("/biomes/$biome")({
	validateSearch: z.object({ h: WindowSchema.optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: async ({ params, deps }) => {
		const details = await getBiomeDetails({
			data: { biome: params.biome, h: deps.h },
		});
		if (!details) throw notFound();
		return details;
	},
	head: ({ match, loaderData }) =>
		loaderData
			? pageHead({
					title: `Focos de calor ${loaderData.in} agora · FocosBR`,
					description: regionSentence(loaderData.name, loaderData),
					path: biomePath(loaderData.slug),
					view: { h: match.search.h, biome: loaderData.biome },
					alt: loaderData.name,
				})
			: {},
	component: BiomePage,
});

function BiomePage() {
	const details = Route.useLoaderData();
	const navigate = Route.useNavigate();
	return (
		<Container component="main" size="md" px={{ base: "sm", sm: "md" }} py="md">
			<PageHeader />
			<RegionDetails
				details={details}
				onHoursChange={(h) =>
					navigate({ search: { h: h === 24 ? undefined : h } })
				}
			/>
		</Container>
	);
}
