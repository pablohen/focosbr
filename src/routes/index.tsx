import { createFileRoute } from "@tanstack/react-router";
import { FiresView } from "~/features/fires/components/FiresView";
import { FiresSearchSchema } from "~/features/fires/schemas";
import {
	BrazilIntro,
	regionSentence,
} from "~/features/places/components/RegionIntro";
import { useRegionNavigate } from "~/features/places/navigation";
import { getStatesSummary } from "~/features/places/regions.functions";
import { pageHead } from "~/features/share/head";

export const Route = createFileRoute("/")({
	validateSearch: FiresSearchSchema,
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: ({ deps }) => getStatesSummary({ data: { h: deps.h } }),
	// Keep the map on screen while a new window's summary loads.
	pendingMs: Number.POSITIVE_INFINITY,
	head: ({ match, loaderData }) =>
		pageHead({
			title: "FocosBR · Focos de calor no Brasil agora",
			description: loaderData
				? regionSentence("No Brasil", loaderData)
				: "Focos de calor detectados por satélite no Brasil nas últimas horas, com dados do INPE.",
			path: "/",
			view: {
				h: match.search.h,
				sensor: match.search.sensor,
				biome: match.search.biome,
			},
			alt: "Brasil",
		}),
	component: HomePage,
});

function HomePage() {
	const search = Route.useSearch();
	const summary = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const goTo = useRegionNavigate(search);
	return (
		<FiresView
			title="Focos de calor no Brasil"
			intro={<BrazilIntro summary={summary} />}
			region={{}}
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
