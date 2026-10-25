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
import type { CompareLine } from "../series";

const NUMBER = new Intl.NumberFormat("pt-BR");
const COMPACT = new Intl.NumberFormat("pt-BR", { notation: "compact" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});
const MONTH_INITIALS = "JFMAMJJASOND";
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const HEIGHT = 240;
const PAD = { top: 12, right: 96, bottom: 20, left: 52 };
const LABEL_GAP = 14;
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/** A place's colour: its slot's categorical step (`--series-1…3`). */
export const slotColor = (slot: number) => `var(--series-${slot + 1})`;

const dateLabel = (day: number) =>
	DAY_MONTH.format(new Date(Date.UTC(2025, 0, day)));

function niceStep(max: number) {
	const raw = Math.max(1, max / 3);
	const pow = 10 ** Math.floor(Math.log10(raw));
	const n = raw / pow;
	return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** End labels' y positions, nudged apart so close lines don't overlap. */
function spreadLabels(ys: number[]) {
	const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
	for (let k = 1; k < order.length; k++) {
		const prev = order[k - 1];
		const cur = order[k];
		if (prev && cur && cur.y - prev.y < LABEL_GAP) cur.y = prev.y + LABEL_GAP;
	}
	const out = [...ys];
	for (const o of order) out[o.i] = o.y;
	return out;
}

/**
 * Season curves of up to three places on one axis: this year (solid) and
 * the average of past years (dashed), in each place's slot colour, named
 * at the line's end. Counts, or each place's % of its average year.
 */
export function CompareChart({
	lines,
	scale,
	year,
	firstYear,
}: {
	lines: CompareLine[];
	scale: "count" | "index";
	year: number;
	firstYear: number;
}) {
	const [asTable, setAsTable] = useState(false);
	const [hover, setHover] = useState<number | null>(null);
	const { ref, width: measured } = useElementSize();
	const width = measured || 640;
	const days = lines[0]?.average.map((p) => p.day) ?? [];
	const fmt = (v: number) =>
		scale === "index" ? `${NUMBER.format(v)}%` : NUMBER.format(v);
	const top = Math.max(
		1,
		...lines.flatMap((l) => [...l.current, ...l.average].map((p) => p.value)),
	);
	const step = niceStep(top);
	const yMax = Math.ceil(top / step) * step;
	const plotW = width - PAD.left - PAD.right;
	const plotH = HEIGHT - PAD.top - PAD.bottom;
	const x = (day: number) => PAD.left + (day / 365) * plotW;
	const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
	const path = (pts: { day: number; value: number }[]) =>
		`M${x(0)},${y(0)}${pts.map((p) => `L${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join("")}`;
	const ends = lines.map((l) => l.current.at(-1) ?? { day: 0, value: 0 });
	const labelY = spreadLabels(ends.map((e) => y(e.value)));
	const ticks = Array.from(
		{ length: Math.round(yMax / step) + 1 },
		(_, i) => i * step,
	);
	const at = (pts: { day: number; value: number }[], day: number) =>
		pts.find((p) => p.day === day)?.value;
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
	if (!lines.length) return null;

	return (
		<Stack gap={6}>
			<Group justify="space-between" align="center" wrap="nowrap">
				<Text size="sm" fw={600}>
					{scale === "index"
						? "Acumulado no ano, em % do ano médio de cada lugar"
						: "Focos acumulados no ano (satélite de referência)"}
				</Text>
				<Tooltip label={asTable ? "Ver gráfico" : "Ver tabela"}>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="sm"
						onClick={() => setAsTable((t) => !t)}
						aria-label={asTable ? "Ver gráfico" : "Ver tabela"}
					>
						{asTable ? <ChartLineIcon size={16} /> : <TableIcon size={16} />}
					</ActionIcon>
				</Tooltip>
			</Group>
			{asTable ? (
				<ScrollArea.Autosize mah={320}>
					<Table {...COMPACT_TABLE}>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Até</Table.Th>
								{lines.map((l) => (
									<Table.Th key={l.slot} ta="right" colSpan={2}>
										{l.name}
									</Table.Th>
								))}
							</Table.Tr>
							<Table.Tr>
								<Table.Th />
								{lines.map((l) => [
									<Table.Th key={`${l.slot}c`} ta="right">
										{year}
									</Table.Th>,
									<Table.Th key={`${l.slot}a`} ta="right">
										Média
									</Table.Th>,
								])}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{days.map((d) => (
								<Table.Tr key={d}>
									<Table.Td>{dateLabel(d)}</Table.Td>
									{lines.map((l) => {
										const c = at(l.current, d);
										return [
											<Table.Td key={`${l.slot}c`} ta="right">
												{c === undefined ? "" : fmt(c)}
											</Table.Td>,
											<Table.Td key={`${l.slot}a`} ta="right">
												{fmt(at(l.average, d) ?? 0)}
											</Table.Td>,
										];
									})}
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
							aria-label={`${lines
								.map((l, i) => `${l.name}: ${fmt(ends[i]?.value ?? 0)}`)
								.join(
									"; ",
								)} até ${dateLabel(ends[0]?.day ?? 1)}. Use "Ver tabela" para os valores.`}
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
										{scale === "index" ? `${t}%` : COMPACT.format(t)}
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
							{lines.map((l) => (
								<path
									key={`a${l.slot}`}
									d={path(l.average)}
									fill="none"
									stroke={slotColor(l.slot)}
									strokeWidth={1.5}
									strokeDasharray="6 4"
									opacity={0.8}
								/>
							))}
							{lines.map((l) => (
								<path
									key={`c${l.slot}`}
									d={path(l.current)}
									fill="none"
									stroke={slotColor(l.slot)}
									strokeWidth={2}
									strokeLinejoin="round"
								/>
							))}
							{lines.map((l, i) => {
								const end = ends[i];
								if (!end) return null;
								return (
									<g key={`e${l.slot}`}>
										<circle
											cx={x(end.day)}
											cy={y(end.value)}
											r={4}
											fill={slotColor(l.slot)}
											stroke="var(--mantine-color-body)"
											strokeWidth={2}
										/>
										<text
											x={x(end.day) + 8}
											y={labelY[i]}
											dy="0.35em"
											fontSize={11}
											fontWeight={600}
											fill="var(--mantine-color-text)"
										>
											{l.name.length > 16 ? `${l.name.slice(0, 15)}…` : l.name}
										</text>
									</g>
								);
							})}
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
						{hd !== null && (
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
								{lines.map((l) => {
									const c = at(l.current, hd);
									return (
										<Group key={l.slot} gap={6} wrap="nowrap">
											<Box
												w={8}
												h={8}
												bg={slotColor(l.slot)}
												style={{ borderRadius: 4 }}
											/>
											<Text size="xs" style={NUMERIC}>
												{l.name}: {c === undefined ? "—" : fmt(c)} · média{" "}
												{fmt(at(l.average, hd) ?? 0)}
											</Text>
										</Group>
									);
								})}
							</Paper>
						)}
					</Box>
					<Group gap="md" wrap="wrap">
						{lines.map((l) => (
							<Group key={l.slot} gap={6} wrap="nowrap">
								<Box w={14} h={3} bg={slotColor(l.slot)} />
								<Text size="xs">{l.name}</Text>
							</Group>
						))}
						<Text size="xs" c="dimmed">
							linha cheia: {year} · tracejada: média de {firstYear} a {year - 1}
						</Text>
					</Group>
				</>
			)}
		</Stack>
	);
}
