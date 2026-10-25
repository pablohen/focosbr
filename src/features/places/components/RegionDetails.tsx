import {
	Anchor,
	Breadcrumbs,
	Button,
	Divider,
	Group,
	Paper,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { MapTrifoldIcon, ScalesIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FireEstimate } from "~/features/fires/components/FireEstimate";
import { Freshness } from "~/features/fires/components/Freshness";
import { HourlyChart } from "~/features/fires/components/HourlyChart";
import { type BBox, WINDOWS, type Window } from "~/features/fires/schemas";
import { AGE_BANDS } from "~/features/fires/view";
import { ForecastStrip } from "~/features/forecast/components/ForecastStrip";
import { HistorySection } from "~/features/history/components/HistorySection";
import { LIST_TABLE } from "~/lib/tables";
import { biomeByName } from "../biomes";
import { slugify } from "../places";
import type {
	getBiomeDetails,
	getCityDetails,
	getStateDetails,
} from "../regions.functions";
import { CityCircleMap } from "./CityCircleMap";
import { EmbedButton } from "./EmbedButton";
import { regionSentence } from "./RegionIntro";
import { BiomeLink, MunicipalityLink, StateLink } from "./RegionLinks";
import { RegionMap } from "./RegionMap";

type StateDetails = NonNullable<Awaited<ReturnType<typeof getStateDetails>>>;
type CityDetails = NonNullable<Awaited<ReturnType<typeof getCityDetails>>>;
type BiomeDetails = NonNullable<Awaited<ReturnType<typeof getBiomeDetails>>>;

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

/** "1 h 20 min", "35 min", or "uma passagem" for a single satellite pass. */
function duration(first: string, last: string): string {
	const minutes = Math.round((Date.parse(last) - Date.parse(first)) / 60_000);
	if (minutes < 1) return "uma passagem";
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} h ${m} min` : `${h} h`;
}

/** A fire's extent, widened to at least ~5 km so the map opens around it. */
function around([w, s, e, n]: BBox): BBox {
	const pad = (a: number, b: number) => Math.max(0, (0.05 - (b - a)) / 2);
	const px = pad(w, e);
	const py = pad(s, n);
	const r = (v: number) => Math.round(v * 1000) / 1000;
	return [r(w - px), r(s - py), r(e + px), r(n + py)];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Stack gap="xs">
			<Title order={2} size="h4">
				{title}
			</Title>
			{children}
		</Stack>
	);
}

function CountTable({
	rows,
	head,
}: {
	rows: { name: ReactNode; key: string; values: number[] }[];
	head: string[];
}) {
	return (
		<Table {...LIST_TABLE}>
			<Table.Thead>
				<Table.Tr>
					{head.map((h, k) => (
						<Table.Th key={h} ta={k ? "right" : undefined}>
							{h}
						</Table.Th>
					))}
				</Table.Tr>
			</Table.Thead>
			<Table.Tbody>
				{rows.map((r) => (
					<Table.Tr key={r.key}>
						<Table.Td>{r.name}</Table.Td>
						{r.values.map((v, k) => (
							<Table.Td
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns.
								key={k}
								ta="right"
								style={{ fontVariantNumeric: "tabular-nums" }}
							>
								{NUMBER.format(v)}
							</Table.Td>
						))}
					</Table.Tr>
				))}
			</Table.Tbody>
		</Table>
	);
}

/**
 * A state's, city's or biome's page: its numbers, a map, the hourly profile, the
 * biggest fires and breakdowns, all rendered on the server. The interactive
 * map is one link away.
 */
export function RegionDetails({
	details: d,
	onHoursChange,
}: {
	details: StateDetails | CityDetails | BiomeDetails;
	onHoursChange: (hours: Window) => void;
}) {
	const biome = "biome" in d ? d : null;
	const city = "label" in d ? d : null;
	const state = !biome && !city ? (d as StateDetails) : null;
	const name = city ? city.label : d.name;
	const h = d.hours === 24 ? undefined : d.hours;
	const mapSearch = biome
		? { biome: biome.biome, h }
		: city
			? { state: city.uf, city: city.label, h }
			: { state: state?.uf, h };
	const compareKey = biome
		? `biome/${biome.slug}`
		: city
			? `${city.uf.toLowerCase()}/${slugify(city.name)}`
			: (state?.uf.toLowerCase() ?? "br");
	const embedPath = biome
		? `/embed/biomes/${biome.slug}`
		: city
			? `/embed/cities/${city.uf.toLowerCase()}/${slugify(city.name)}`
			: `/embed/states/${state?.uf.toLowerCase()}`;

	return (
		<Stack gap="xl">
			<Stack gap="xs">
				{biome ? (
					<Breadcrumbs separator="›" fz="sm" py={4}>
						<Anchor
							renderRoot={(props) => <Link {...props} to="/biomes" />}
							size="sm"
							py={6}
						>
							Biomas
						</Anchor>
						<Text size="sm">{biome.name}</Text>
					</Breadcrumbs>
				) : (
					<Breadcrumbs separator="›" fz="sm" py={4}>
						<Anchor
							renderRoot={(props) => <Link {...props} to="/states" />}
							size="sm"
							py={6}
						>
							Estados
						</Anchor>
						{city ? (
							<StateLink uf={city.uf} hours={d.hours} size="sm" py={6}>
								{city.stateName}
							</StateLink>
						) : (
							<Text size="sm">{d.name}</Text>
						)}
						{city && <Text size="sm">{city.name}</Text>}
					</Breadcrumbs>
				)}
				<Title order={1} size="h2">
					Focos de calor {biome ? biome.in : `em ${name}`}
				</Title>
				<Group justify="space-between" align="center">
					<SegmentedControl
						size="xs"
						value={String(d.hours)}
						onChange={(v) => onHoursChange(Number(v) as Window)}
						data={WINDOWS.map((h) => ({ value: String(h), label: `${h} h` }))}
						aria-label="Período"
					/>
					<Group gap="xs">
						{/* The page's main action: filled, and first in reading order. */}
						<Button
							size="xs"
							variant="filled"
							leftSection={<MapTrifoldIcon size={16} />}
							renderRoot={(props) => (
								<Link {...props} to="/" search={mapSearch} />
							)}
						>
							Ver no mapa interativo
						</Button>
						<Button
							size="xs"
							variant="default"
							leftSection={<ScalesIcon size={16} />}
							renderRoot={(props) => (
								<Link
									{...props}
									to="/compare"
									search={{ places: compareKey }}
								/>
							)}
						>
							Comparar
						</Button>
						<EmbedButton embedPath={embedPath} name={name} />
					</Group>
				</Group>
			</Stack>

			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
				<Stack gap="sm">
					<FireEstimate fires={d.fires} />
					<Text c="dimmed">
						{NUMBER.format(d.total)}{" "}
						{d.total === 1 ? "foco detectado" : "focos detectados"} nas últimas{" "}
						{d.hours} horas
						{d.latestAt && ` · último ${CLOCK.format(new Date(d.latestAt))}`}
					</Text>
					{d.total === 0 && <Text>{regionSentence(name, d)}</Text>}
					{d.preliminary > 0 && (
						<Text size="sm" c="dimmed">
							Inclui {NUMBER.format(d.preliminary)}{" "}
							{d.preliminary === 1 ? "foco preliminar" : "focos preliminares"},
							ainda sem município e bioma (o INPE completa na próxima
							atualização).
						</Text>
					)}
					<Freshness
						sourceUpdatedAt={d.sourceUpdatedAt}
						renderedAt={d.generatedAt}
					/>
					{d.weather && (
						<Paper withBorder p="sm" radius="md">
							<Stack gap={4}>
								<Text size="sm" fw={600}>
									Clima nos locais (dias já fechados pelo INPE)
								</Text>
								{d.weather.medianDryDays !== null && (
									<Text size="sm">
										Mediana de {NUMBER.format(d.weather.medianDryDays)} dias sem
										chuva
									</Text>
								)}
								<Text size="sm">
									Risco de fogo:{" "}
									{d.weather.riskClasses
										.map(
											(r) =>
												`${r.name} ${Math.round((r.count / (d.weather?.known ?? 1)) * 100)}%`,
										)
										.join(" · ")}
								</Text>
								<Text size="xs" c="dimmed">
									De {NUMBER.format(d.weather.known)}{" "}
									{d.weather.known === 1 ? "detecção" : "detecções"} com esses
									dados.
								</Text>
							</Stack>
						</Paper>
					)}
				</Stack>
				<Stack gap={6}>
					<RegionMap
						map={d.map}
						label={`Mapa de ${name} com os focos das últimas ${d.hours} horas`}
					/>
					<Group gap="md">
						{AGE_BANDS.map((b) => (
							<Group key={b.label} gap={6} wrap="nowrap">
								<svg width={10} height={10} aria-hidden="true">
									<circle cx={5} cy={5} r={5} fill={b.color} />
								</svg>
								<Text size="xs">{b.label}</Text>
							</Group>
						))}
					</Group>
				</Stack>
			</SimpleGrid>

			{/* The chart carries its own "Focos por hora" heading. */}
			{d.total > 0 && <HourlyChart buckets={d.hourly} />}

			{d.topFires.length > 0 && (
				<Section title={`Maiores fogos (${d.hours} h)`}>
					<Stack
						gap={6}
						component="ol"
						m={0}
						p={0}
						style={{ listStyle: "none" }}
					>
						{d.topFires.map((f, k) => (
							<li key={f.id}>
								<Group justify="space-between" wrap="nowrap" gap="sm">
									<Stack gap={0} style={{ minWidth: 0 }}>
										<Text size="sm" fw={600} truncate>
											{/* On a city page every fire is in the city: number them. */}
											{city ? `Fogo ${k + 1}` : `${k + 1}. ${f.place}`}
										</Text>
										<Text size="xs" c="dimmed">
											{NUMBER.format(f.count)}{" "}
											{f.count === 1 ? "detecção" : "detecções"}
											{f.totalFrp !== null &&
												` · ${NUMBER.format(f.totalFrp)} MW`}
											{` · ${duration(f.first, f.last)}, até ${CLOCK.format(new Date(f.last))}`}
										</Text>
									</Stack>
									<Anchor
										size="xs"
										py={6}
										style={{ whiteSpace: "nowrap", display: "inline-block" }}
										renderRoot={(props) => (
											<Link
												{...props}
												to="/"
												search={{ ...mapSearch, bbox: around(f.bounds) }}
											/>
										)}
									>
										ver no mapa
									</Anchor>
								</Group>
							</li>
						))}
					</Stack>
					<Text size="xs" c="dimmed">
						Fogos estimados juntando focos a até 2 km e 1 hora uns dos outros,
						ordenados pelo número de detecções.
					</Text>
				</Section>
			)}

			{"cities" in d && d.cities.length > 0 && (
				<Section title={`Municípios com mais focos (${d.hours} h)`}>
					<CountTable
						head={["Município", "Fogos", "Focos"]}
						rows={d.cities.map((c) => ({
							key: c.name,
							name: (
								<MunicipalityLink uf={c.uf} name={c.name} hours={d.hours}>
									{/* A biome spans states: say which. */}
									{biome ? `${c.name} (${c.uf})` : c.name}
								</MunicipalityLink>
							),
							values: [c.fires, c.total],
						}))}
					/>
				</Section>
			)}

			{d.total > 0 && (
				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
					{!biome && (
						<Section title={`Biomas (${d.hours} h)`}>
							<CountTable
								head={["Bioma", "Focos"]}
								rows={d.biomes.map((b) => {
									const known = biomeByName(b.name);
									return {
										key: b.name,
										name: known ? (
											<BiomeLink slug={known.slug} hours={d.hours}>
												{b.name}
											</BiomeLink>
										) : (
											b.name
										),
										values: [b.count],
									};
								})}
							/>
						</Section>
					)}
					<Section title={`Sensores (${d.hours} h)`}>
						<CountTable
							head={["Sensor", "Focos"]}
							rows={d.sensors.map((s) => ({
								key: s.name,
								name: s.name,
								values: [s.count],
							}))}
						/>
					</Section>
				</SimpleGrid>
			)}

			{"forecast" in d && d.forecast && (
				<Divider label="Próximos dias" labelPosition="left" />
			)}
			{"forecast" in d && d.forecast && (
				<ForecastStrip forecast={d.forecast} name={name} />
			)}

			{d.history && (
				<Divider label="No ano e desde 2003" labelPosition="left" />
			)}
			{d.history && <HistorySection history={d.history} name={name} />}

			{state?.cityCircles && state.cityCircles.length > 0 && (
				<CityCircleMap
					uf={state.uf}
					stateName={state.name}
					map={state.map}
					circles={state.cityCircles}
				/>
			)}

			<Text size="xs" c="dimmed">
				Nuvens e fumaça escondem focos: não ter focos não garante que não haja
				fogo.
			</Text>
		</Stack>
	);
}
