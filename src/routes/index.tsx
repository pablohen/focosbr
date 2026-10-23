import { Box, Center, Loader } from "@mantine/core";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { lazy, Suspense, useMemo } from "react";
import { FirePanel } from "~/features/fires/components/FirePanel";
import { FiresSearchSchema } from "~/features/fires/schemas";
import { useFires } from "~/features/fires/use-fires";
import { selectFires, summarize, toFeatures } from "~/features/fires/view";

const FireMap = lazy(() => import("~/features/fires/components/FireMap"));

export const Route = createFileRoute("/")({
	validateSearch: FiresSearchSchema,
	head: () => ({ links: [{ rel: "stylesheet", href: maplibreCss }] }),
	component: FiresPage,
});

const MAP_FALLBACK = (
	<Center pos="absolute" inset={0}>
		<Loader aria-label="Carregando mapa" />
	</Center>
);

function FiresPage() {
	const { h: hours = 24, sensor: sensors = [] } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, error, loading } = useFires(hours);

	const indices = useMemo(
		() => (data ? selectFires(data, sensors) : []),
		[data, sensors],
	);
	const summary = useMemo(
		() => (data ? summarize(data, indices) : undefined),
		[data, indices],
	);
	const features = useMemo(
		() =>
			data
				? toFeatures(data, indices, Date.parse(data.generatedAt))
				: toFeatures(EMPTY, [], 0),
		[data, indices],
	);

	return (
		<Box
			component="main"
			pos="relative"
			h="100dvh"
			style={{ overflow: "hidden" }}
		>
			<ClientOnly fallback={MAP_FALLBACK}>
				<Suspense fallback={MAP_FALLBACK}>
					<FireMap data={data} features={features} />
				</Suspense>
			</ClientOnly>
			<FirePanel
				hours={hours}
				onHoursChange={(h) =>
					navigate({ search: (s) => ({ ...s, h: h === 24 ? undefined : h }) })
				}
				sensors={sensors}
				onSensorsChange={(next) =>
					navigate({
						search: (s) => ({ ...s, sensor: next.length ? next : undefined }),
					})
				}
				data={data}
				summary={summary}
				loading={loading}
				error={error}
			/>
		</Box>
	);
}

const EMPTY = {
	generatedAt: new Date(0).toISOString(),
	hours: 24,
	latestAt: null,
	satellites: [],
	states: [],
	places: [],
	biomes: [],
	fires: {
		lon: [],
		lat: [],
		t: [],
		frp: [],
		sat: [],
		state: [],
		place: [],
		biome: [],
	},
} satisfies Parameters<typeof toFeatures>[0];
