import {
	AppShell,
	Box,
	Center,
	Group,
	Loader,
	Text,
	Title,
} from "@mantine/core";
import { Fire } from "@phosphor-icons/react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { lazy, Suspense, useMemo } from "react";
import { FirePanel } from "~/features/fires/components/FirePanel";
import { FiresSearchSchema } from "~/features/fires/schemas";
import { useFires } from "~/features/fires/use-fires";
import { selectFires, summarize, toFeatures } from "~/features/fires/view";
import { ColorSchemeToggle } from "~/features/theme/components/ColorSchemeToggle";
import { useProgress } from "~/lib/route-progress";

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
	const {
		h: hours = 24,
		sensor: sensors = [],
		uf,
		bioma: biome,
	} = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, error, loading } = useFires(hours);
	useProgress(loading);

	const filters = useMemo(() => ({ sensors, uf, biome }), [sensors, uf, biome]);
	const indices = useMemo(
		() => (data ? selectFires(data, filters) : []),
		[data, filters],
	);
	const summary = useMemo(
		() => (data ? summarize(data, filters) : undefined),
		[data, filters],
	);
	const features = useMemo(
		() =>
			data
				? toFeatures(data, indices, Date.parse(data.generatedAt))
				: toFeatures(EMPTY, [], 0),
		[data, indices],
	);

	return (
		<AppShell header={{ height: 56 }} padding={0}>
			<AppShell.Header>
				<Group
					h="100%"
					px={{ base: "xs", sm: "md" }}
					justify="space-between"
					wrap="nowrap"
				>
					<Group gap="xs" wrap="nowrap">
						<Fire
							size={26}
							weight="duotone"
							color="var(--mantine-primary-color-filled)"
							aria-hidden
						/>
						<Title order={1} size="h4">
							FocosBR
						</Title>
						<Text size="sm" c="dimmed" visibleFrom="sm">
							Focos de calor detectados por satélite, quase em tempo real
						</Text>
					</Group>
					<ColorSchemeToggle />
				</Group>
			</AppShell.Header>

			<AppShell.Main>
				<Box
					pos="relative"
					h="calc(100dvh - var(--app-shell-header-height))"
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
							navigate({
								search: (s) => ({ ...s, h: h === 24 ? undefined : h }),
							})
						}
						sensors={sensors}
						onSensorsChange={(next) =>
							navigate({
								search: (s) => ({
									...s,
									sensor: next.length ? next : undefined,
								}),
							})
						}
						uf={uf}
						biome={biome}
						onRegionChange={(region) =>
							navigate({
								search: (s) => ({ ...s, uf: region.uf, bioma: region.biome }),
							})
						}
						data={data}
						summary={summary}
						loading={loading}
						error={error}
					/>
				</Box>
			</AppShell.Main>
		</AppShell>
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
