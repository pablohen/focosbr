import { AppShell, Box, Center, Loader } from "@mantine/core";
import { ClientOnly } from "@tanstack/react-router";
import {
	lazy,
	type ReactNode,
	Suspense,
	useEffect,
	useMemo,
	useState,
} from "react";
import { SiteHeader } from "~/features/places/components/SiteHeader";
import { useProgress } from "~/lib/route-progress";
import type { BBox, FiresSearch, Sensor, Window } from "../schemas";
import { useFires } from "../use-fires";
import {
	boundsOf,
	hourlyCounts,
	selectFires,
	summarize,
	toFeatures,
} from "../view";
import type { FireTarget } from "./FireMap";
import { FirePanel } from "./FirePanel";

const FireMap = lazy(() => import("./FireMap"));

const MAP_FALLBACK = (
	<Center pos="absolute" inset={0}>
		<Loader aria-label="Carregando mapa" />
	</Center>
);

type Props = {
	/** The panel's heading (the page's h1). */
	title: string;
	/** Server-rendered text with links, for the panel. */
	intro?: ReactNode;
	search: FiresSearch;
	/** Updates the query (window, sensors, region, map position). */
	onSearchChange: (
		patch: Partial<FiresSearch>,
		options?: { replace?: boolean },
	) => void;
};

/** The map and its panel. All of its state lives in the query string. */
export function FiresView({ title, intro, search, onSearchChange }: Props) {
	const uf = search.state;
	const place = search.city;
	const hours: Window = search.h ?? 24;
	const sensors: Sensor[] = search.sensor ?? [];
	const biome = search.biome;
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
				<SiteHeader bare />
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
								initialBBox={search.bbox}
								onViewportChange={(next: BBox) =>
									onSearchChange({ bbox: next }, { replace: true })
								}
							/>
						</Suspense>
					</ClientOnly>
					<FirePanel
						title={title}
						intro={intro}
						hours={hours}
						onHoursChange={(h) =>
							onSearchChange({ h: h === 24 ? undefined : h })
						}
						sensors={sensors}
						onSensorsChange={(next) =>
							onSearchChange({ sensor: next.length ? next : undefined })
						}
						uf={uf}
						biome={biome}
						place={place}
						onRegionChange={(next) =>
							onSearchChange({
								state: next.uf,
								city: next.place,
								biome: next.biome,
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
