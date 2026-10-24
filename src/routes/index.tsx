import { createFileRoute } from "@tanstack/react-router";
import { FiresView } from "~/features/fires/components/FiresView";
import { FiresSearchSchema } from "~/features/fires/schemas";
import { STATE_NAMES } from "~/features/fires/states";
import {
	BrazilIntro,
	regionSentence,
} from "~/features/places/components/RegionIntro";
import {
	MunicipalityLink,
	StateLink,
} from "~/features/places/components/RegionLinks";
import { splitPlaceLabel } from "~/features/places/places";
import { getStatesSummary } from "~/features/places/regions.functions";
import { regionLabel } from "~/features/share/card";
import { pageHead } from "~/features/share/head";

/** The map: every filter, the region included, lives in the query. */
export const Route = createFileRoute("/")({
	validateSearch: FiresSearchSchema,
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: ({ deps }) => getStatesSummary({ data: { h: deps.h } }),
	// Keep the map on screen while a new window's summary loads.
	pendingMs: Number.POSITIVE_INFINITY,
	head: ({ match, loaderData }) => {
		const view = {
			h: match.search.h,
			sensor: match.search.sensor,
			biome: match.search.biome,
			state: match.search.state,
			city: match.search.city,
		};
		const region = regionLabel(view);
		return pageHead({
			title:
				region === "Brasil"
					? "FocosBR · Focos de calor no Brasil agora"
					: `Focos de calor em ${region} agora · FocosBR`,
			description: loaderData
				? regionSentence("No Brasil", loaderData)
				: "Focos de calor detectados por satélite no Brasil nas últimas horas, com dados do INPE.",
			path: "/",
			view,
			alt: region,
		});
	},
	component: MapPage,
});

function MapPage() {
	const search = Route.useSearch();
	const summary = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const city = search.city ? splitPlaceLabel(search.city) : null;
	const stateName = search.state && STATE_NAMES[search.state];
	return (
		<FiresView
			title={
				search.city || stateName
					? `Focos de calor em ${search.city ?? stateName}`
					: "Focos de calor no Brasil"
			}
			intro={
				// With a region on the map, point to its details page instead.
				city ? (
					<MunicipalityLink uf={city.uf} name={city.name} size="sm">
						Ver detalhes de {search.city}
					</MunicipalityLink>
				) : search.state && stateName ? (
					<StateLink uf={search.state} size="sm">
						Ver detalhes de {stateName}
					</StateLink>
				) : (
					<BrazilIntro summary={summary} />
				)
			}
			search={search}
			onSearchChange={(patch, options) =>
				navigate({
					search: (s) => ({ ...s, ...patch }),
					replace: options?.replace,
				})
			}
		/>
	);
}
