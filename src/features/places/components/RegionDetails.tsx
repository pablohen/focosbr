import {
	Anchor,
	Breadcrumbs,
	Button,
	Group,
	Paper,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { MapTrifoldIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Freshness } from "~/features/fires/components/Freshness";
import { HourlyChart } from "~/features/fires/components/HourlyChart";
import { type BBox, WINDOWS, type Window } from "~/features/fires/schemas";
import { AGE_BANDS } from "~/features/fires/view";
import type { getCityDetails, getStateDetails } from "../regions.functions";
import { regionSentence } from "./RegionIntro";
import { MunicipalityLink, StateLink } from "./RegionLinks";
import { RegionMap } from "./RegionMap";

type StateDetails = NonNullable<Awaited<ReturnType<typeof getStateDetails>>>;
type CityDetails = NonNullable<Awaited<ReturnType<typeof getCityDetails>>>;

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
		<Table verticalSpacing={4} fz="sm" highlightOnHover>
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
 * A state's or city's page: its numbers, a map, the hourly profile, the
 * biggest fires and breakdowns, all rendered on the server. The interactive
 * map is one link away.
 */
export function RegionDetails({
	details: d,
	onHoursChange,
}: {
	details: StateDetails | CityDetails;
	onHoursChange: (hours: Window) => void;
}) {
	const city = "label" in d ? d : null;
	const name = city ? city.label : d.name;
	const stateName = city ? city.stateName : d.name;
	const mapSearch = {
		state: d.uf,
		city: city?.label,
		h: d.hours === 24 ? undefined : d.hours,
	};

	return (
		<Stack gap="xl">
			<Stack gap="xs">
				<Breadcrumbs separator="›" fz="sm">
					<Anchor
						renderRoot={(props) => <Link {...props} to="/states" />}
						size="sm"
					>
						Estados
					</Anchor>
					{city ? (
						<StateLink uf={d.uf} hours={d.hours} size="sm">
							{stateName}
						</StateLink>
					) : (
						<Text size="sm">{stateName}</Text>
					)}
					{city && <Text size="sm">{city.name}</Text>}
				</Breadcrumbs>
				<Title order={1} size="h2">
					Focos de calor em {name}
				</Title>
				<Group justify="space-between" align="center">
					<SegmentedControl
						size="xs"
						value={String(d.hours)}
						onChange={(v) => onHoursChange(Number(v) as Window)}
						data={WINDOWS.map((h) => ({ value: String(h), label: `${h} h` }))}
						aria-label="Período"
					/>
					<Button
						size="xs"
						variant="light"
						leftSection={<MapTrifoldIcon size={16} />}
						renderRoot={(props) => (
							<Link {...props} to="/" search={mapSearch} />
						)}
					>
						Ver no mapa interativo
					</Button>
				</Group>
			</Stack>

			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
				<Stack gap="sm">
					<Group gap={8} align="baseline" wrap="nowrap">
						<Text fz={44} fw={700} lh={1}>
							≈ {NUMBER.format(d.fires)}
						</Text>
						<Text fw={600}>{d.fires === 1 ? "fogo" : "fogos"}</Text>
					</Group>
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
					<Freshness sourceUpdatedAt={d.sourceUpdatedAt} />
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
				<Section title="Maiores fogos">
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
										style={{ whiteSpace: "nowrap" }}
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
				<Section title="Municípios com mais focos">
					<CountTable
						head={["Município", "Fogos", "Focos"]}
						rows={d.cities.map((c) => ({
							key: c.name,
							name: (
								<MunicipalityLink uf={c.uf} name={c.name} hours={d.hours}>
									{c.name}
								</MunicipalityLink>
							),
							values: [c.fires, c.total],
						}))}
					/>
				</Section>
			)}

			{d.total > 0 && (
				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
					<Section title="Biomas">
						<CountTable
							head={["Bioma", "Focos"]}
							rows={d.biomes.map((b) => ({
								key: b.name,
								name: b.name,
								values: [b.count],
							}))}
						/>
					</Section>
					<Section title="Sensores">
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

			<Text size="xs" c="dimmed">
				Foco de calor é uma detecção de satélite, não um incêndio confirmado;
				nuvens e fumaça escondem focos. Dados: INPE, Programa Queimadas.
			</Text>
		</Stack>
	);
}
