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
import { COMPACT_TABLE } from "~/lib/tables";

const NUMBER = new Intl.NumberFormat("pt-BR");

export type Bar = {
	key: string;
	/** Full label for the tooltip and table: "2024", "out. 2026", "24/10". */
	label: string;
	value: number;
	/** Still counting (this year, this month, today): drawn faded. */
	partial?: boolean;
};

const HEIGHT = 72;

/**
 * Bars over time with a tooltip per bar and a table view, in the hourly
 * chart's style. Peak and endpoints are labelled; everything else is in the
 * tooltips and the table.
 */
export function BarSeries({
	title,
	bars,
	unit = "focos",
}: {
	title: string;
	bars: Bar[];
	/** Plural noun for the values, in tooltips and the table header. */
	unit?: string;
}) {
	const [asTable, setAsTable] = useState(false);
	const max = Math.max(1, ...bars.map((b) => b.value));
	const peak = bars.reduce(
		(a, b) => (b.value > a.value ? b : a),
		bars[0] ?? { key: "", label: "", value: 0 },
	);
	const first = bars[0];
	const last = bars.at(-1);
	if (!first || !last) return null;
	return (
		<Stack gap={4}>
			<Group justify="space-between" align="center" wrap="nowrap">
				<Text size="sm" fw={600}>
					{title}
				</Text>
				<Group gap={6} wrap="nowrap">
					<Text size="xs" c="dimmed">
						pico {NUMBER.format(peak.value)} em {peak.label}
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
				<ScrollArea.Autosize mah={240}>
					<Table {...COMPACT_TABLE}>
						<Table.Thead>
							<Table.Tr>
								<Table.Th fw={600}>Período</Table.Th>
								<Table.Th fw={600} ta="right">
									{unit[0]?.toUpperCase()}
									{unit.slice(1)}
								</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{[...bars].reverse().map((b) => (
								<Table.Tr key={b.key}>
									<Table.Td>
										{b.label}
										{b.partial && " (até agora)"}
									</Table.Td>
									<Table.Td
										ta="right"
										style={{ fontVariantNumeric: "tabular-nums" }}
									>
										{NUMBER.format(b.value)}
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
						aria-label={`${title}; pico de ${NUMBER.format(peak.value)} em ${peak.label}. Use "Ver tabela" para os valores.`}
						h={HEIGHT}
						style={{
							display: "flex",
							alignItems: "flex-end",
							gap: 2,
							borderBottom: "1px solid var(--mantine-color-default-border)",
						}}
					>
						{bars.map((b) => (
							<Tooltip
								key={b.key}
								label={`${b.label}${b.partial ? " (até agora)" : ""} · ${NUMBER.format(b.value)} ${unit}`}
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
										h={b.value ? Math.max(2, (b.value / max) * HEIGHT) : 0}
										bg="var(--chart-bar)"
										opacity={b.partial ? 0.45 : 1}
										style={{ borderRadius: "2px 2px 0 0" }}
									/>
								</Box>
							</Tooltip>
						))}
					</Box>
					<Group justify="space-between">
						<Text size="xs" c="dimmed">
							{first.label}
						</Text>
						<Text size="xs" c="dimmed">
							{last.label}
						</Text>
					</Group>
				</>
			)}
		</Stack>
	);
}
