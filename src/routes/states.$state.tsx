import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { FiresView } from "~/features/fires/components/FiresView";
import { FiresSearchSchema } from "~/features/fires/schemas";
import {
	regionSentence,
	StateIntro,
} from "~/features/places/components/RegionIntro";
import { useRegionNavigate } from "~/features/places/navigation";
import { statePath } from "~/features/places/places";
import { getStateSummary } from "~/features/places/regions.functions";
import { pageHead } from "~/features/share/head";

/** A state's page: /states/pa. */
export const Route = createFileRoute("/states/$state")({
	validateSearch: FiresSearchSchema,
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
		const summary = await getStateSummary({
			data: { state: params.state, h: deps.h },
		});
		if (!summary) throw notFound();
		return summary;
	},
	// Keep the map on screen while a new window's summary loads.
	pendingMs: Number.POSITIVE_INFINITY,
	head: ({ match, loaderData }) =>
		loaderData
			? pageHead({
					title: `Focos de calor em ${loaderData.name} agora · FocosBR`,
					description: regionSentence(loaderData.name, loaderData),
					path: statePath(loaderData.uf),
					view: {
						h: match.search.h,
						sensor: match.search.sensor,
						biome: match.search.biome,
						state: loaderData.uf,
					},
					alt: loaderData.name,
				})
			: {},
	component: StatePage,
});

function StatePage() {
	const search = Route.useSearch();
	const summary = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const goTo = useRegionNavigate(search);
	return (
		<FiresView
			title={`Focos de calor em ${summary.name}`}
			intro={<StateIntro summary={summary} />}
			region={{ uf: summary.uf }}
			search={search}
			onSearchChange={(patch, options) =>
				navigate({
					search: (s) => ({ ...s, ...patch }),
					replace: options?.replace,
				})
			}
			onRegionChange={goTo}
		/>
	);
}
