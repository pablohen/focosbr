import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { anomalyStep } from "../build";
import { percentVsAverage } from "../format";
import type { Rankings } from "../schemas";

const NUMBER = new Intl.NumberFormat("pt-BR");

/** The diverging scale's classes, below to above, with their labels. */
export const ANOMALY_STEPS = [
	{ step: -2, label: "menos da metade" },
	{ step: -1, label: "abaixo" },
	{ step: 0, label: "perto da média" },
	{ step: 1, label: "acima" },
	{ step: 2, label: "mais do dobro" },
] as const;

/**
 * Brazil's states coloured by this year so far against their own average
 * for the same period: blue below, ember above, grey within 0.8–1.25×.
 * Outlines are projected on the server; the rankings table below it is the
 * table view.
 */
export function AnomalyMap({
	map,
	states,
}: {
	map: Rankings["map"];
	states: Rankings["states"];
}) {
	const byUf = new Map(states.map((s) => [s.uf, s]));
	const counts = new Map<number, number>();
	for (const s of states) {
		const k = anomalyStep(s.ratio);
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	return (
		<Stack gap="xs">
			<Box
				component="svg"
				viewBox={`0 0 ${map.width} ${map.height}`}
				role="img"
				aria-label={`Mapa dos estados em relação à própria média: ${ANOMALY_STEPS.map(
					(s) => `${counts.get(s.step) ?? 0} ${s.label}`,
				).join(", ")}. Os valores estão na tabela de estados.`}
				w="100%"
				maw={460}
				mx="auto"
				style={{ display: "block", height: "auto" }}
			>
				{map.states.map(({ uf, path }) => {
					const s = byUf.get(uf);
					return (
						<Tooltip
							key={uf}
							withArrow
							openDelay={0}
							label={
								s
									? `${s.name}: ${NUMBER.format(s.current)} focos, ${s.ratio === null ? "sem média" : `${percentVsAverage(s.ratio)} vs. média (${NUMBER.format(Math.round(s.average))})`}`
									: uf
							}
						>
							<path
								d={path}
								fill={`var(--anom-${anomalyStep(s?.ratio ?? null)})`}
								// The grey midpoint is close to the page's surface: outline it.
								stroke={
									anomalyStep(s?.ratio ?? null) === 0
										? "var(--mantine-color-dimmed)"
										: "var(--mantine-color-body)"
								}
								strokeWidth={1}
								strokeLinejoin="round"
							/>
						</Tooltip>
					);
				})}
			</Box>
			<Group gap="sm" justify="center" wrap="wrap">
				{ANOMALY_STEPS.map((s) => (
					<Group key={s.step} gap={6} wrap="nowrap">
						<Box
							w={12}
							h={12}
							bg={`var(--anom-${s.step})`}
							style={{
								borderRadius: 2,
								border: "1px solid var(--mantine-color-default-border)",
							}}
							aria-hidden
						/>
						<Text size="xs" c="dimmed">
							{s.label}
						</Text>
					</Group>
				))}
			</Group>
		</Stack>
	);
}
