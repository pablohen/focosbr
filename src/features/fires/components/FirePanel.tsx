import {
	Alert,
	Anchor,
	Box,
	Chip,
	Group,
	Loader,
	Paper,
	ScrollArea,
	SegmentedControl,
	Select,
	Skeleton,
	Stack,
	Table,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { WarningCircle } from "@phosphor-icons/react";
import {
	type FiresResponse,
	SENSORS,
	type Sensor,
	WINDOWS,
	type Window,
} from "../schemas";
import { STATE_NAMES } from "../states";
import {
	AGE_BANDS,
	type HourBucket,
	type Ranked,
	SENSOR_LABELS,
	type summarize,
} from "../view";
import { Freshness } from "./Freshness";
import { HourlyChart } from "./HourlyChart";

const NUMBER = new Intl.NumberFormat("pt-BR");
const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

type Props = {
	hours: Window;
	onHoursChange: (hours: Window) => void;
	sensors: Sensor[];
	onSensorsChange: (sensors: Sensor[]) => void;
	uf: string | undefined;
	biome: string | undefined;
	place: string | undefined;
	/** The whole new region; a missing part is cleared. */
	onRegionChange: (region: Region) => void;
	data: FiresResponse | undefined;
	summary: ReturnType<typeof summarize> | undefined;
	hourly: HourBucket[] | undefined;
	loading: boolean;
	error: unknown;
};

type Region = { uf?: string; biome?: string; place?: string };

const ROWS = 5;

/** "—" when INPE has no value (offshore detections have no state or biome). */
const display = (name: string) => name || "—";

/**
 * Top rows of a breakdown; each row selects (or, when selected, clears)
 * that value. The selected row stays listed even outside the top.
 */
function RankTable({
	caption,
	rows,
	selected,
	label = display,
	onToggle,
}: {
	caption: string;
	rows: Ranked[];
	selected: string | undefined;
	label?: (name: string) => string;
	onToggle: (name: string | undefined) => void;
}) {
	const top = rows.slice(0, ROWS);
	const pinned = rows.find((r) => r.name === selected);
	if (pinned && !top.includes(pinned)) top.push(pinned);
	if (top.length === 0) return null;
	return (
		<Table verticalSpacing={2} horizontalSpacing={0} fz="sm" captionSide="top">
			<Table.Caption ta="left" fw={600} c="var(--mantine-color-text)" mb={4}>
				{caption}
			</Table.Caption>
			<Table.Tbody>
				{top.map((r) => {
					const active = r.name === selected;
					return (
						<Table.Tr
							key={r.name}
							bg={active ? "var(--mantine-primary-color-light)" : undefined}
						>
							<Table.Td>
								<UnstyledButton
									fz="sm"
									fw={active ? 700 : undefined}
									disabled={!r.name}
									onClick={() => onToggle(active ? undefined : r.name)}
									aria-pressed={active}
								>
									{label(r.name)}
								</UnstyledButton>
							</Table.Td>
							<Table.Td
								ta="right"
								fw={active ? 700 : undefined}
								style={{ fontVariantNumeric: "tabular-nums" }}
							>
								{NUMBER.format(r.count)}
							</Table.Td>
						</Table.Tr>
					);
				})}
			</Table.Tbody>
		</Table>
	);
}

/** Controls and counts, floating over the map (bottom sheet on phones). */
export function FirePanel({
	hours,
	onHoursChange,
	sensors,
	onSensorsChange,
	uf,
	biome,
	place,
	onRegionChange,
	data,
	summary,
	hourly,
	loading,
	error,
}: Props) {
	return (
		<Paper
			shadow="md"
			radius={0}
			pos="absolute"
			left={{ base: 0, sm: 16 }}
			right={{ base: 0, sm: "auto" }}
			top={{ base: "auto", sm: 16 }}
			bottom={{ base: 0, sm: "auto" }}
			w={{ base: "100%", sm: 340 }}
			style={{ zIndex: 2, borderRadius: "var(--mantine-radius-md)" }}
		>
			<ScrollArea.Autosize mah={{ base: "45dvh", sm: "calc(100dvh - 32px)" }}>
				<Stack gap="sm" p="md">
					<Group gap="xs" wrap="nowrap" justify="space-between">
						<Title order={2} size="h5">
							Focos de calor no Brasil
						</Title>
						{loading && <Loader size="xs" aria-label="Atualizando" />}
					</Group>

					<SegmentedControl
						fullWidth
						size="xs"
						value={String(hours)}
						onChange={(v) => onHoursChange(Number(v) as Window)}
						data={WINDOWS.map((h) => ({ value: String(h), label: `${h} h` }))}
						aria-label="Período"
					/>

					{error && !data ? (
						<Alert
							color="red"
							variant="light"
							icon={<WarningCircle />}
							title="Não foi possível carregar os focos"
						>
							O servidor do INPE não respondeu. Tentaremos de novo em alguns
							minutos.
						</Alert>
					) : summary && data ? (
						<Box>
							<Group gap={8} align="baseline" wrap="nowrap">
								<Text fz={32} fw={700} lh={1.1}>
									≈ {NUMBER.format(summary.fires)}
								</Text>
								<Text size="sm" fw={600}>
									{summary.fires === 1 ? "fogo" : "fogos"}
								</Text>
							</Group>
							<Text size="sm" c="dimmed">
								{NUMBER.format(summary.total)}{" "}
								{summary.total === 1 ? "foco detectado" : "focos detectados"}{" "}
								nas últimas {hours} horas
								{(uf || biome || place) &&
									` em ${[place ?? (uf && (STATE_NAMES[uf] ?? uf)), biome].filter(Boolean).join(" · ")}`}
								{data.latestAt &&
									` · último às ${CLOCK.format(new Date(data.latestAt))}`}
							</Text>
							{summary.preliminary > 0 && (
								<Text size="xs" c="dimmed">
									Inclui {NUMBER.format(summary.preliminary)}{" "}
									{summary.preliminary === 1
										? "foco preliminar"
										: "focos preliminares"}
									, publicados pelo INPE depois da última atualização completa
									(ainda sem município e bioma).
								</Text>
							)}
							<Box mt={6}>
								<Freshness sourceUpdatedAt={data.sourceUpdatedAt} />
							</Box>
						</Box>
					) : (
						<Skeleton h={52} />
					)}

					{hourly && summary?.total ? <HourlyChart buckets={hourly} /> : null}

					<Stack gap={4}>
						<Text size="sm" fw={600}>
							Detectado há
						</Text>
						<Group gap="md">
							{AGE_BANDS.map((b) => (
								<Group key={b.label} gap={6} wrap="nowrap">
									<Box
										w={12}
										h={12}
										bg={b.color}
										style={{ borderRadius: "50%", border: "1.5px solid white" }}
									/>
									<Text size="xs">{b.label}</Text>
								</Group>
							))}
						</Group>
						<Text size="xs" c="dimmed">
							Pontos maiores indicam fogo mais intenso (potência radiativa). De
							longe, focos próximos se agrupam em círculos numerados, com a cor
							do mais recente; toque para aproximar.
						</Text>
					</Stack>

					<Group grow gap="xs" align="flex-end">
						<Select
							label="Estado"
							placeholder="Todos"
							size="xs"
							searchable
							clearable
							value={uf ?? null}
							onChange={(v) => onRegionChange({ uf: v ?? undefined, biome })}
							data={(summary?.states ?? [])
								.filter((r) => r.name)
								.map((r) => ({
									value: r.name,
									label: `${STATE_NAMES[r.name] ?? r.name} · ${NUMBER.format(r.count)}`,
								}))}
							nothingFoundMessage="Nenhum foco"
						/>
						<Select
							label="Bioma"
							placeholder="Todos"
							size="xs"
							searchable
							clearable
							value={biome ?? null}
							onChange={(v) => onRegionChange({ uf, biome: v ?? undefined })}
							data={(summary?.biomes ?? [])
								.filter((r) => r.name)
								.map((r) => ({
									value: r.name,
									label: `${r.name} · ${NUMBER.format(r.count)}`,
								}))}
							nothingFoundMessage="Nenhum foco"
						/>
					</Group>

					<Stack gap={6}>
						<Text size="sm" fw={600}>
							Sensores
						</Text>
						<Chip.Group
							multiple
							value={sensors}
							onChange={(v) => onSensorsChange(v as Sensor[])}
						>
							<Group gap={6}>
								{SENSORS.filter(
									(s) =>
										!summary || summary.bySensor.has(s) || sensors.includes(s),
								).map((s) => (
									<Chip key={s} value={s} size="xs">
										{SENSOR_LABELS[s]}
										{summary?.bySensor.has(s) &&
											` ${NUMBER.format(summary.bySensor.get(s) ?? 0)}`}
									</Chip>
								))}
							</Group>
						</Chip.Group>
						<Text size="xs" c="dimmed">
							Nenhum selecionado mostra todos. VIIRS é o mais detalhado (375 m);
							GOES passa a cada 10 minutos, mas com menos precisão.
						</Text>
					</Stack>

					{summary && (
						<Group align="flex-start" grow gap="lg">
							<RankTable
								caption="Estados"
								rows={summary.states}
								selected={uf}
								onToggle={(next) => onRegionChange({ uf: next, biome })}
							/>
							<RankTable
								caption="Biomas"
								rows={summary.biomes}
								selected={biome}
								onToggle={(next) => onRegionChange({ uf, biome: next })}
							/>
						</Group>
					)}
					{summary && (
						<RankTable
							caption="Municípios"
							rows={summary.places}
							selected={place}
							onToggle={(next) => onRegionChange({ uf, biome, place: next })}
						/>
					)}

					<Text size="xs" c="dimmed">
						Foco de calor é uma detecção de satélite, não um incêndio
						confirmado. O número de fogos junta focos a até 2 km e 1 hora uns
						dos outros, já que vários satélites veem o mesmo fogo; é uma
						estimativa. Nuvens ou fumaça escondem focos. Dados:{" "}
						<Anchor
							href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/"
							target="_blank"
							rel="noreferrer"
							size="xs"
						>
							INPE, Programa Queimadas
						</Anchor>
						, atualizados ao longo do dia.
					</Text>
				</Stack>
			</ScrollArea.Autosize>
		</Paper>
	);
}
