import {
	ActionIcon,
	Box,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
	Tooltip,
} from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { ChartLineIcon, TableIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { COMPACT_TABLE } from "~/lib/tables";
import type { RegionHistory } from "../schemas";

type Season = RegionHistory["season"];

const NUMBER = new Intl.NumberFormat("pt-BR");
const COMPACT = new Intl.NumberFormat("pt-BR", { notation: "compact" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});
const MONTH_INITIALS = "JFMAMJJASOND";
/** First day of the year of each month, on a non-leap year. */
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

const HEIGHT = 200;
const PAD = { top: 12, right: 44, bottom: 20, left: 52 };
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/** "23 de out." for a day of the year (non-leap). */
const dateLabel = (day: number) =>
	DAY_MONTH.format(new Date(Date.UTC(2025, 0, day)));

/** A round step giving about three gridlines up to `max`. */
function niceStep(max: number) {
	const raw = Math.max(1, max / 3);
	const pow = 10 ** Math.floor(Math.log10(raw));
	const n = raw / pow;
	return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * The fire-season tracker: this year's running total of reference-satellite
 * detections from 1 January against the range (band), average (dashed) and
 * record year (dotted) of every past year. Hover shows a sample day's
 * values; the table lists them all.
 */
export function SeasonChart({
	season,
	firstYear,
}: {
	season: Season;
	firstYear: number;
}) {
	const [asTable, setAsTable] = useState(false);
	const [hover, setHover] = useState<number | null>(null);
	const { ref, width: measured } = useElementSize();
	const width = measured || 640;
	const { days, min, max, average, record, current } = season;
	const last = current.points.at(-1);
	const lastPast = current.year - 1;
	const top = Math.max(
		1,
		...max,
		...(record?.values ?? []),
		...current.points.map((p) => p.count),
	);
	const step = niceStep(top);
	const yMax = Math.ceil(top / step) * step;
	const plotW = width - PAD.left - PAD.right;
	const plotH = HEIGHT - PAD.top - PAD.bottom;
	const x = (day: number) => PAD.left + (day / 365) * plotW;
	const y = (n: number) => PAD.top + plotH - (n / yMax) * plotH;
	const line = (pts: [number, number][]) =>
		`M${x(0)},${y(0)}${pts.map(([d, n]) => `L${x(d).toFixed(1)},${y(n).toFixed(1)}`).join("")}`;
	const series = (values: number[]) =>
		line(days.map((d, k) => [d, values[k] ?? 0]));
	const band = `${series(max)}${[...days]
		.reverse()
		.map(
			(d, k) =>
				`L${x(d).toFixed(1)},${y(min[days.length - 1 - k] ?? 0).toFixed(1)}`,
		)
		.join("")}L${x(0)},${y(0)}Z`;
	const currentAt = (day: number) =>
		current.points.find((p) => p.day === day)?.count;
	const ticks = Array.from(
		{ length: Math.round(yMax / step) + 1 },
		(_, i) => i * step,
	);

	const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
		const box = e.currentTarget.getBoundingClientRect();
		const day = ((e.clientX - box.left - PAD.left) / plotW) * 365;
		let best = 0;
		for (let k = 1; k < days.length; k++)
			if (Math.abs((days[k] ?? 0) - day) < Math.abs((days[best] ?? 0) - day))
				best = k;
		setHover(best);
	};
	const hd = hover === null ? null : (days[hover] ?? null);

	return (
		<Stack gap={6}>
			<Group justify="space-between" align="center" wrap="nowrap">
				<Text size="sm" fw={600}>
					Temporada de queimadas: focos acumulados no ano (satélite de
					referência)
				</Text>
				<Tooltip label={asTable ? "Ver gráfico" : "Ver tabela"}>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="md"
						onClick={() => setAsTable((t) => !t)}
						aria-label={asTable ? "Ver gráfico" : "Ver tabela"}
					>
						{asTable ? <ChartLineIcon size={16} /> : <TableIcon size={16} />}
					</ActionIcon>
				</Tooltip>
			</Group>
			{asTable ? (
				<ScrollArea.Autosize mah={280}>
					<Table {...COMPACT_TABLE}>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Até</Table.Th>
								<Table.Th ta="right">{current.year}</Table.Th>
								<Table.Th ta="right">Média</Table.Th>
								<Table.Th ta="right">Mín.</Table.Th>
								<Table.Th ta="right">Máx.</Table.Th>
								{record && <Table.Th ta="right">{record.year}</Table.Th>}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{days.map((d, k) => (
								<Table.Tr key={d}>
									<Table.Td>{dateLabel(d)}</Table.Td>
									<Table.Td ta="right">
										{currentAt(d) === undefined
											? ""
											: NUMBER.format(currentAt(d) ?? 0)}
									</Table.Td>
									<Table.Td ta="right">
										{NUMBER.format(average[k] ?? 0)}
									</Table.Td>
									<Table.Td ta="right">{NUMBER.format(min[k] ?? 0)}</Table.Td>
									<Table.Td ta="right">{NUMBER.format(max[k] ?? 0)}</Table.Td>
									{record && (
										<Table.Td ta="right">
											{NUMBER.format(record.values[k] ?? 0)}
										</Table.Td>
									)}
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</ScrollArea.Autosize>
			) : (
				<>
					<Box ref={ref} pos="relative">
						<svg
							width="100%"
							height={HEIGHT}
							viewBox={`0 0 ${width} ${HEIGHT}`}
							role="img"
							aria-label={`Focos acumulados desde 1º de janeiro: ${current.year} soma ${NUMBER.format(last?.count ?? 0)} até ${dateLabel(last?.day ?? 1)}; a média de ${firstYear} a ${lastPast} na mesma data é ${NUMBER.format(average[days.findIndex((d) => d >= (last?.day ?? 0))] ?? 0)}. Use "Ver tabela" para os valores.`}
							onPointerMove={onMove}
							onPointerLeave={() => setHover(null)}
							style={{ display: "block", touchAction: "pan-y" }}
						>
							{ticks.map((t) => (
								<g key={t}>
									<line
										x1={PAD.left}
										x2={width - PAD.right}
										y1={y(t)}
										y2={y(t)}
										stroke="var(--mantine-color-default-border)"
										strokeWidth={1}
									/>
									<text
										x={PAD.left - 6}
										y={y(t)}
										dy="0.35em"
										textAnchor="end"
										fontSize={11}
										fill="var(--mantine-color-dimmed)"
									>
										{COMPACT.format(t)}
									</text>
								</g>
							))}
							{MONTH_STARTS.map((d, m) => (
								<text
									key={d}
									x={x(d + 14)}
									y={HEIGHT - 4}
									textAnchor="middle"
									fontSize={11}
									fill="var(--mantine-color-dimmed)"
								>
									{MONTH_INITIALS[m]}
								</text>
							))}
							<path d={band} fill="var(--season-band)" />
							<path
								d={series(average)}
								fill="none"
								stroke="var(--mantine-color-dimmed)"
								strokeWidth={2}
								strokeDasharray="6 4"
							/>
							{record && (
								<path
									d={series(record.values)}
									fill="none"
									stroke="var(--mantine-color-dimmed)"
									strokeWidth={1.5}
									strokeDasharray="1 3"
									strokeLinecap="round"
								/>
							)}
							<path
								d={line(current.points.map((p) => [p.day, p.count]))}
								fill="none"
								stroke="var(--chart-bar)"
								strokeWidth={2}
								strokeLinejoin="round"
							/>
							{last && (
								<>
									<circle
										cx={x(last.day)}
										cy={y(last.count)}
										r={4}
										fill="var(--chart-bar)"
										stroke="var(--mantine-color-body)"
										strokeWidth={2}
									/>
									<text
										x={x(last.day) + 8}
										y={y(last.count)}
										dy="0.35em"
										fontSize={11}
										fontWeight={600}
										fill="var(--mantine-color-text)"
									>
										{current.year}
									</text>
								</>
							)}
							{record && (
								<text
									x={x(365) + 4}
									y={y(record.values.at(-1) ?? 0)}
									dy="0.35em"
									fontSize={11}
									fill="var(--mantine-color-dimmed)"
								>
									{record.year}
								</text>
							)}
							<text
								x={x(365) + 4}
								y={y(average.at(-1) ?? 0)}
								dy="0.35em"
								fontSize={11}
								fill="var(--mantine-color-dimmed)"
							>
								média
							</text>
							{hd !== null && (
								<line
									x1={x(hd)}
									x2={x(hd)}
									y1={PAD.top}
									y2={PAD.top + plotH}
									stroke="var(--mantine-color-text)"
									strokeOpacity={0.4}
									strokeWidth={1}
								/>
							)}
						</svg>
						{hover !== null && hd !== null && (
							<Paper
								withBorder
								shadow="sm"
								p={6}
								pos="absolute"
								top={0}
								style={{
									pointerEvents: "none",
									...(x(hd) > width / 2
										? { right: width - x(hd) + 8 }
										: { left: x(hd) + 8 }),
								}}
							>
								<Text size="xs" fw={600}>
									Até {dateLabel(hd)}
								</Text>
								<Text size="xs" style={NUMERIC}>
									{currentAt(hd) !== undefined &&
										`${current.year}: ${NUMBER.format(currentAt(hd) ?? 0)} · `}
									média {NUMBER.format(average[hover] ?? 0)}
								</Text>
								<Text size="xs" c="dimmed" style={NUMERIC}>
									faixa {NUMBER.format(min[hover] ?? 0)}–
									{NUMBER.format(max[hover] ?? 0)}
									{record &&
										` · ${record.year}: ${NUMBER.format(record.values[hover] ?? 0)}`}
								</Text>
							</Paper>
						)}
					</Box>
					<Group gap="md" wrap="wrap">
						<Legend
							mark={<Box w={14} h={2} bg="var(--chart-bar)" />}
							label={`${current.year} (até ${dateLabel(last?.day ?? 1)})`}
						/>
						<Legend mark={<Dash pattern="6 4" width={2} />} label="média" />
						{record && (
							<Legend
								mark={<Dash pattern="1 3" width={1.5} />}
								label={`recorde (${record.year})`}
							/>
						)}
						<Legend
							mark={<Box w={14} h={10} bg="var(--season-band)" />}
							label={`faixa de ${firstYear} a ${lastPast}`}
						/>
					</Group>
				</>
			)}
		</Stack>
	);
}

function Legend({ mark, label }: { mark: React.ReactNode; label: string }) {
	return (
		<Group gap={6} wrap="nowrap">
			{mark}
			<Text size="xs" c="dimmed">
				{label}
			</Text>
		</Group>
	);
}

function Dash({ pattern, width }: { pattern: string; width: number }) {
	return (
		<svg width={16} height={4} aria-hidden>
			<line
				x1={1}
				x2={15}
				y1={2}
				y2={2}
				stroke="var(--mantine-color-dimmed)"
				strokeWidth={width}
				strokeDasharray={pattern}
				strokeLinecap="round"
			/>
		</svg>
	);
}
