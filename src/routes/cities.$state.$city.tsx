import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { PageShell } from "~/features/places/components/PageShell";
import { RegionDetails } from "~/features/places/components/RegionDetails";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { municipalityPath } from "~/features/places/places";
import { getCityDetails } from "~/features/places/regions.functions";
import { pageHead } from "~/features/share/head";

/** A city's details page: /cities/pa/altamira. */
export const Route = createFileRoute("/cities/$state/$city")({
	validateSearch: z.object({ h: WindowSchema.optional().catch(undefined) }),
	beforeLoad: ({ search, params }) => {
		// One URL per city: /cities/PA/altamira → /cities/pa/altamira.
		if (params.state !== params.state.toLowerCase())
			throw redirect({
				to: "/cities/$state/$city",
				params: { state: params.state.toLowerCase(), city: params.city },
				search,
				statusCode: 301,
			});
	},
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: async ({ params, deps }) => {
		const details = await getCityDetails({
			data: { state: params.state, city: params.city, h: deps.h },
		});
		if (!details) throw notFound();
		return details;
	},
	head: ({ match, loaderData }) =>
		loaderData
			? pageHead({
					title: `Focos de calor em ${loaderData.label} agora · FocosBR`,
					description: regionSentence(loaderData.label, loaderData),
					path: municipalityPath(loaderData.uf, loaderData.name),
					view: {
						h: match.search.h,
						state: loaderData.uf,
						city: loaderData.label,
					},
					alt: loaderData.label,
				})
			: {},
	component: CityPage,
});

function CityPage() {
	const details = Route.useLoaderData();
	const navigate = Route.useNavigate();
	return (
		<PageShell>
			<RegionDetails
				details={details}
				onHoursChange={(h) =>
					navigate({ search: { h: h === 24 ? undefined : h } })
				}
			/>
		</PageShell>
	);
}
