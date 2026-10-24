import {
	ActionIcon,
	Box,
	Group,
	ScrollArea,
	Stack,
	Table,
	Text,
	Tooltip,
} from "@mantine/core";
import { ChartBarIcon, TableIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { HourBucket } from "../view";

const NUMBER = new Intl.NumberFormat("pt-BR");
const HOUR = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});
const DAY_HOUR = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

const HEIGHT = 64;

/** "qui., 20:00–21:00" */
const hourLabel = (b: HourBucket) =>
	`${DAY_HOUR.format(b.start)}–${HOUR.format(b.start + 3_600_000)}`;

/**
 * Detections per hour, one column each. Peaks follow satellite passes
 * (VIIRS and MODIS overfly Brazil at set times), so the shape shows both
 * fire activity and when the satellites looked. A toggle swaps the bars for
 * a table, so the numbers don't depend on hovering or seeing the chart.
 */
export function HourlyChart({ buckets }: { buckets: HourBucket[] }) {
	const [asTable, setAsTable] = useState(false);
	const max = Math.max(1, ...buckets.map((b) => b.count));
	const first = buckets[0];
	const peak = buckets.reduce(
		(a, b) => (b.count > a.count ? b : a),
		buckets[0] ?? { start: 0, count: 0 },
	);
	if (!first) return null;
	return (
		<Stack gap={4}>
			<Group justify="space-between" align="center" wrap="nowrap">
				<Text size="sm" fw={600}>
					Focos por hora
				</Text>
				<Group gap={6} wrap="nowrap">
					<Text size="xs" c="dimmed">
						pico {NUMBER.format(peak.count)} às {HOUR.format(peak.start)}
					</Text>
					<Tooltip label={asTable ? "Ver gráfico" : "Ver tabela"}>
						<ActionIcon
							variant="subtle"
							color="gray"
							size="sm"
							onClick={() => setAsTable((t) => !t)}
							aria-label={asTable ? "Ver gráfico" : "Ver tabela"}
						>
							{asTable ? <ChartBarIcon size={16} /> : <TableIcon size={16} />}
						</ActionIcon>
					</Tooltip>
				</Group>
			</Group>

			{asTable ? (
				<ScrollArea.Autosize mah={200}>
					<Table verticalSpacing={2} horizontalSpacing={0} fz="sm">
						<Table.Thead>
							<Table.Tr>
								<Table.Th fw={600}>Hora (Brasília)</Table.Th>
								<Table.Th fw={600} ta="right">
									Focos
								</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{/* Newest first: the hour that matters most is on top. */}
							{[...buckets].reverse().map((b) => (
								<Table.Tr key={b.start}>
									<Table.Td>{hourLabel(b)}</Table.Td>
									<Table.Td
										ta="right"
										style={{ fontVariantNumeric: "tabular-nums" }}
									>
										{NUMBER.format(b.count)}
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</ScrollArea.Autosize>
			) : (
				<>
					<Box
						role="img"
						aria-label={`Focos por hora; pico de ${NUMBER.format(peak.count)} às ${HOUR.format(peak.start)}. Use "Ver tabela" para os valores.`}
						h={HEIGHT}
						style={{
							display: "flex",
							alignItems: "flex-end",
							gap: 2,
							borderBottom: "1px solid var(--mantine-color-default-border)",
						}}
					>
						{buckets.map((b) => (
							<Tooltip
								key={b.start}
								label={`${hourLabel(b)} · ${NUMBER.format(b.count)} ${b.count === 1 ? "foco" : "focos"}`}
								withArrow
								openDelay={0}
							>
								{/* The whole column is the hover target, not just the bar. */}
								<Box
									h="100%"
									style={{
										flex: 1,
										maxWidth: 24,
										display: "flex",
										alignItems: "flex-end",
									}}
								>
									<Box
										w="100%"
										h={b.count ? Math.max(2, (b.count / max) * HEIGHT) : 0}
										bg="var(--chart-bar)"
										style={{ borderRadius: "2px 2px 0 0" }}
									/>
								</Box>
							</Tooltip>
						))}
					</Box>
					<Group justify="space-between">
						<Text size="xs" c="dimmed">
							{DAY_HOUR.format(first.start)}
						</Text>
						<Text size="xs" c="dimmed">
							agora
						</Text>
					</Group>
				</>
			)}
		</Stack>
	);
}
