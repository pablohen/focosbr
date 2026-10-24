import {
	AppShell,
	Box,
	Center,
	Group,
	Loader,
	Text,
	Title,
} from "@mantine/core";
import { FireIcon } from "@phosphor-icons/react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { FireTarget } from "~/features/fires/components/FireMap";
import { FirePanel } from "~/features/fires/components/FirePanel";
import { FiresSearchSchema } from "~/features/fires/schemas";
import { useFires } from "~/features/fires/use-fires";
import {
	boundsOf,
	hourlyCounts,
	selectFires,
	summarize,
	toFeatures,
} from "~/features/fires/view";
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	cardPath,
	regionLabel,
} from "~/features/share/card";
import { CopyLinkButton } from "~/features/share/components/CopyLinkButton";
import { ColorSchemeToggle } from "~/features/theme/components/ColorSchemeToggle";
import { useProgress } from "~/lib/route-progress";
import { absoluteUrl } from "~/lib/site";

const FireMap = lazy(() => import("~/features/fires/components/FireMap"));

export const Route = createFileRoute("/")({
	validateSearch: FiresSearchSchema,
	// Share previews: a card for the view (window, sensors, region) and a
	// title naming the region. The map position doesn't change the card.
	head: ({ match }) => {
		const view = match.search;
		const region = regionLabel(view);
		const title =
			region === "Brasil"
				? "FocosBR · Focos de calor no Brasil agora"
				: `Focos de calor em ${region} agora · FocosBR`;
		const image = absoluteUrl(cardPath(view));
		return {
			meta: [
				{ title },
				{ property: "og:title", content: title },
				{ property: "og:image", content: image },
				{ property: "og:image:width", content: String(CARD_WIDTH) },
				{ property: "og:image:height", content: String(CARD_HEIGHT) },
				{
					property: "og:image:alt",
					content: `Mapa e número estimado de fogos: ${region}`,
				},
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:image", content: image },
			],
			links: [{ rel: "stylesheet", href: maplibreCss }],
		};
	},
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
		municipio: place,
		bbox,
	} = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, error, loading, refreshFailed, updatedAt } = useFires(hours);
	useProgress(loading);
	const [target, setTarget] = useState<FireTarget | null>(null);

	// Timeline position (Unix seconds), null for live. Playback state, not a
	// view to share, so it stays out of the URL; a new window starts live.
	const [until, setUntil] = useState<number | null>(null);
	const shownHours = data?.hours;
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the window shown changes.
	useEffect(() => setUntil(null), [shownHours]);
	const filters = useMemo(
		() => ({ sensors, uf, biome, place, until: until ?? undefined }),
		[sensors, uf, biome, place, until],
	);
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
				? // Ages from the timeline position, so a replay colours as it was.
					toFeatures(
						data,
						indices,
						until !== null ? until * 1000 : Date.parse(data.generatedAt),
					)
				: toFeatures(EMPTY, [], 0),
		[data, indices, until],
	);

	const hourly = useMemo(
		() =>
			data
				? // The whole window, whatever the timeline position.
					hourlyCounts(
						data,
						selectFires(data, { ...filters, until: undefined }),
						data.hours,
						Date.parse(data.generatedAt),
					)
				: undefined,
		[data, filters],
	);
	const focus = useMemo(() => {
		const key =
			uf || biome || place ? `${uf ?? ""}|${biome ?? ""}|${place ?? ""}` : "";
		return {
			key,
			bounds: key && data ? boundsOf(data, indices) : null,
			uf,
		};
	}, [uf, biome, place, data, indices]);

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
						<FireIcon
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
					<Group gap="xs" wrap="nowrap">
						<CopyLinkButton />
						<ColorSchemeToggle />
					</Group>
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
							<FireMap
								data={data}
								features={features}
								focus={focus}
								groups={summary?.groups}
								target={target}
								initialBBox={bbox}
								onViewportChange={(next) =>
									navigate({
										search: (s) => ({ ...s, bbox: next }),
										replace: true,
									})
								}
							/>
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
						place={place}
						onRegionChange={(region) =>
							navigate({
								search: (s) => ({
									...s,
									uf: region.uf,
									bioma: region.biome,
									municipio: region.place,
								}),
							})
						}
						data={data}
						summary={summary}
						indices={indices}
						hourly={hourly}
						until={until}
						onUntilChange={setUntil}
						onSelectFire={(fire) =>
							setTarget((t) => ({ nonce: (t?.nonce ?? 0) + 1, fire }))
						}
						loading={loading}
						error={error}
						refreshFailed={refreshFailed}
						updatedAt={updatedAt}
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
	sourceUpdatedAt: null,
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
		prelim: [],
		dry: [],
		rain: [],
		risk: [],
	},
} satisfies Parameters<typeof toFeatures>[0];
