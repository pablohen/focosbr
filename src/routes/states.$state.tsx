import { Container } from "@mantine/core";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { PageHeader } from "~/features/places/components/PageHeader";
import { RegionDetails } from "~/features/places/components/RegionDetails";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { statePath } from "~/features/places/places";
import { getStateDetails } from "~/features/places/regions.functions";
import { pageHead } from "~/features/share/head";

/** A state's details page: /states/pa. */
export const Route = createFileRoute("/states/$state")({
	validateSearch: z.object({ h: WindowSchema.optional().catch(undefined) }),
	beforeLoad: ({ search, params }) => {
		// One URL per state: /states/PA → /states/pa.
		if (params.state !== params.state.toLowerCase())
			throw redirect({
				to: "/states/$state",
				params: { state: params.state.toLowerCase() },
				search,
				statusCode: 301,
			});
	},
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: async ({ params, deps }) => {
		const details = await getStateDetails({
			data: { state: params.state, h: deps.h },
		});
		if (!details) throw notFound();
		return details;
	},
	head: ({ match, loaderData }) =>
		loaderData
			? pageHead({
					title: `Focos de calor em ${loaderData.name} agora · FocosBR`,
					description: regionSentence(loaderData.name, loaderData),
					path: statePath(loaderData.uf),
					view: { h: match.search.h, state: loaderData.uf },
					alt: loaderData.name,
				})
			: {},
	component: StatePage,
});

function StatePage() {
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
