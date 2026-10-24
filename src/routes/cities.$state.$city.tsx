import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { FiresView } from "~/features/fires/components/FiresView";
import { FiresSearchSchema } from "~/features/fires/schemas";
import {
	MunicipalityIntro,
	regionSentence,
} from "~/features/places/components/RegionIntro";
import { useRegionNavigate } from "~/features/places/navigation";
import { municipalityPath } from "~/features/places/places";
import { getMunicipalitySummary } from "~/features/places/regions.functions";
import { pageHead } from "~/features/share/head";

/** A city's page: /cities/pa/altamira. */
export const Route = createFileRoute("/cities/$state/$city")({
	validateSearch: FiresSearchSchema,
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
		const summary = await getMunicipalitySummary({
			data: { state: params.state, city: params.city, h: deps.h },
		});
		if (!summary) throw notFound();
		return summary;
	},
	// Keep the map on screen while a new window's summary loads.
	pendingMs: Number.POSITIVE_INFINITY,
	head: ({ match, loaderData }) =>
		loaderData
			? pageHead({
					title: `Focos de calor em ${loaderData.label} agora · FocosBR`,
					description: regionSentence(loaderData.label, loaderData),
					path: municipalityPath(loaderData.uf, loaderData.name),
					view: {
						h: match.search.h,
						sensor: match.search.sensor,
						biome: match.search.biome,
						state: loaderData.uf,
						city: loaderData.label,
					},
					alt: loaderData.label,
				})
			: {},
	component: CityPage,
});

function CityPage() {
	const search = Route.useSearch();
	const summary = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const goTo = useRegionNavigate(search);
	return (
		<FiresView
			title={`Focos de calor em ${summary.label}`}
			intro={<MunicipalityIntro summary={summary} />}
			region={{ uf: summary.uf, place: summary.label }}
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
