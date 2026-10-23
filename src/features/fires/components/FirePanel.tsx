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
	Skeleton,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { WarningCircle } from "@phosphor-icons/react";
import {
	type FiresResponse,
	SENSORS,
	type Sensor,
	WINDOWS,
	type Window,
} from "../schemas";
import { AGE_BANDS, type Ranked, SENSOR_LABELS, type summarize } from "../view";

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
	data: FiresResponse | undefined;
	summary: ReturnType<typeof summarize> | undefined;
	loading: boolean;
	error: unknown;
};

function RankTable({ caption, rows }: { caption: string; rows: Ranked[] }) {
	if (rows.length === 0) return null;
	return (
		<Table verticalSpacing={2} horizontalSpacing={0} fz="sm" captionSide="top">
			<Table.Caption ta="left" fw={600} c="var(--mantine-color-text)" mb={4}>
				{caption}
			</Table.Caption>
			<Table.Tbody>
				{rows.map((r) => (
					<Table.Tr key={r.name}>
						<Table.Td>{r.name}</Table.Td>
						<Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
							{NUMBER.format(r.count)}
						</Table.Td>
					</Table.Tr>
				))}
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
	data,
	summary,
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
							<Text fz={32} fw={700} lh={1.1}>
								{NUMBER.format(summary.total)}
							</Text>
							<Text size="sm" c="dimmed">
								focos nas últimas {hours} horas
								{data.latestAt &&
									` · último às ${CLOCK.format(new Date(data.latestAt))}`}
							</Text>
						</Box>
					) : (
						<Skeleton h={52} />
					)}

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
							Pontos maiores indicam fogo mais intenso (potência radiativa).
						</Text>
					</Stack>

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
							<RankTable caption="Estados" rows={summary.states} />
							<RankTable caption="Biomas" rows={summary.biomes} />
						</Group>
					)}

					<Text size="xs" c="dimmed">
						Foco de calor é uma detecção de satélite, não um incêndio
						confirmado. Um mesmo fogo pode aparecer em vários satélites, e
						nuvens ou fumaça escondem focos. Dados:{" "}
						<Anchor
							href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/"
							target="_blank"
							rel="noreferrer"
							size="xs"
						>
							INPE, Programa Queimadas
						</Anchor>
						, atualizados a cada 10 minutos.
					</Text>
				</Stack>
			</ScrollArea.Autosize>
		</Paper>
	);
}
