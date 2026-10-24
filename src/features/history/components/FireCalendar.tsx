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
import { SquaresFourIcon, TableIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { CALENDAR_STEPS, calendarStep } from "../build";
import type { RegionHistory } from "../schemas";

const NUMBER = new Intl.NumberFormat("pt-BR");
/** The ramp's steps, fewest to most: 1…CALENDAR_STEPS. */
const STEPS = Array.from({ length: CALENDAR_STEPS }, (_, i) => i + 1);
const MONTHS = [
	"jan.",
	"fev.",
	"mar.",
	"abr.",
	"mai.",
	"jun.",
	"jul.",
	"ago.",
	"set.",
	"out.",
	"nov.",
	"dez.",
];

/**
 * The fire season, year by year: one row per year since 2003, one cell
 * per month, coloured by the reference satellite's detections on a
 * square-root ramp of the region's busiest month. Months still to come are
 * left out; the current one is still counting (said in its tooltip, not
 * faded, which would read as a different value).
 */
export function FireCalendar({
	calendar,
	through,
}: {
	calendar: RegionHistory["calendar"];
	/** Last complete day ("2026-10-23"): months after it aren't drawn. */
	through: string;
}) {
	const [asTable, setAsTable] = useState(false);
	const lastYear = Number(through.slice(0, 4));
	const lastMonth = Number(through.slice(5, 7));
	/** -1 for a month still to come, 0 for one still counting, 1 for one done. */
	const state = (year: number, m: number) =>
		year < lastYear || m < lastMonth ? 1 : m === lastMonth ? 0 : -1;
	const max = Math.max(0, ...calendar.flatMap((r) => r.months));
	let peak = { year: 0, month: 0, count: 0 };
	for (const r of calendar)
		r.months.forEach((count, m) => {
			if (count > peak.count) peak = { year: r.year, month: m, count };
		});
	const label = (year: number, m: number, count: number) =>
		`${MONTHS[m]} ${year}${state(year, m + 1) === 0 ? " (até agora)" : ""} · ${NUMBER.format(count)} ${count === 1 ? "foco" : "focos"}`;
	if (!calendar.length) return null;
	return (
		<Stack gap={6}>
			<Group justify="space-between" align="center" wrap="nowrap">
				<Text size="sm" fw={600}>
					Calendário das queimadas (satélite de referência)
				</Text>
				<Group gap={6} wrap="nowrap">
					<Text size="xs" c="dimmed">
						pico {NUMBER.format(peak.count)} em {MONTHS[peak.month]} {peak.year}
					</Text>
					<Tooltip label={asTable ? "Ver calendário" : "Ver tabela"}>
						<ActionIcon
							variant="subtle"
							color="gray"
							size="sm"
							onClick={() => setAsTable((t) => !t)}
							aria-label={asTable ? "Ver calendário" : "Ver tabela"}
						>
							{asTable ? (
								<SquaresFourIcon size={16} />
							) : (
								<TableIcon size={16} />
							)}
						</ActionIcon>
					</Tooltip>
				</Group>
			</Group>
			{asTable ? (
				<ScrollArea.Autosize mah={320}>
					<Table
						verticalSpacing={2}
						horizontalSpacing={6}
						fz="xs"
						style={{ fontVariantNumeric: "tabular-nums" }}
					>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Ano</Table.Th>
								{MONTHS.map((m) => (
									<Table.Th key={m} ta="right">
										{m}
									</Table.Th>
								))}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{[...calendar].reverse().map((r) => (
								<Table.Tr key={r.year}>
									<Table.Td>{r.year}</Table.Td>
									{r.months.map((count, m) => (
										<Table.Td key={MONTHS[m]} ta="right">
											{state(r.year, m + 1) < 0 ? "" : NUMBER.format(count)}
										</Table.Td>
									))}
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</ScrollArea.Autosize>
			) : (
				<>
					<Box
						role="img"
						aria-label={`Focos por mês desde ${calendar[0]?.year}; o mês com mais focos foi ${MONTHS[peak.month]} ${peak.year}, com ${NUMBER.format(peak.count)}. Use "Ver tabela" para os valores.`}
						style={{
							display: "grid",
							gridTemplateColumns: "2.5em repeat(12, minmax(0, 1fr))",
							gap: 2,
							maxWidth: 520,
						}}
					>
						<span />
						{MONTHS.map((m) => (
							<Text key={m} size="xs" c="dimmed" ta="center" lh={1.4}>
								{m[0]?.toUpperCase()}
							</Text>
						))}
						{calendar.map((r) => (
							<Row
								key={r.year}
								year={r.year}
								months={r.months}
								max={max}
								state={state}
								label={label}
							/>
						))}
					</Box>
					<Group gap={6} wrap="wrap">
						<Swatch step={0} />
						<Text size="xs" c="dimmed" mr={6}>
							nenhum
						</Text>
						<Text size="xs" c="dimmed">
							menos
						</Text>
						{STEPS.map((step) => (
							<Swatch key={step} step={step} />
						))}
						<Text size="xs" c="dimmed">
							mais
						</Text>
					</Group>
				</>
			)}
		</Stack>
	);
}

function Row({
	year,
	months,
	max,
	state,
	label,
}: {
	year: number;
	months: number[];
	max: number;
	state: (year: number, month: number) => number;
	label: (year: number, m: number, count: number) => string;
}) {
	return (
		<>
			<Text
				size="xs"
				c="dimmed"
				lh="12px"
				style={{ fontVariantNumeric: "tabular-nums" }}
			>
				{year}
			</Text>
			{months.map((count, m) =>
				state(year, m + 1) < 0 ? (
					<span key={MONTHS[m]} />
				) : (
					<Tooltip
						key={MONTHS[m]}
						label={label(year, m, count)}
						withArrow
						openDelay={0}
					>
						<Box
							h={12}
							bg={`var(--cal-${calendarStep(count, max)})`}
							style={{ borderRadius: 2 }}
						/>
					</Tooltip>
				),
			)}
		</>
	);
}

function Swatch({ step }: { step: number }) {
	return (
		<Box
			w={12}
			h={12}
			bg={`var(--cal-${step})`}
			style={{ borderRadius: 2 }}
			aria-hidden
		/>
	);
}
