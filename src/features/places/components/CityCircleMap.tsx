import {
	ActionIcon,
	Box,
	Group,
	ScrollArea,
	Stack,
	Table,
	Text,
	Title,
	Tooltip,
} from "@mantine/core";
import { MapTrifoldIcon, TableIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ANOMALY_STEPS } from "~/features/history/components/AnomalyMap";
import { percentVsAverage } from "~/features/history/format";
import { COMPACT_TABLE } from "~/lib/tables";
import { type CityCircle, MAX_CIRCLES } from "../city-circles";
import { MunicipalityLink } from "./RegionLinks";
import type { RegionMapData } from "./RegionMap";

const NUMBER = new Intl.NumberFormat("pt-BR");
const _NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * Where a state's season is: each city with detections this year as a
 * circle (area: detections; colour: against its own average), over the
 * state map's outlines. Circles link to the city's page; the table lists
 * them all.
 */
export function CityCircleMap({
	uf,
	stateName,
	map,
	circles,
}: {
	uf: string;
	stateName: string;
	map: Pick<RegionMapData, "width" | "height" | "states" | "selected">;
	circles: CityCircle[];
}) {
	const [asTable, setAsTable] = useState(false);
	const label = (c: CityCircle) =>
		`${c.name}: ${NUMBER.format(c.current)} focos no ano${c.ratio === null ? "" : `, ${percentVsAverage(c.ratio)} vs. média`}`;
	return (
		<Stack gap="xs">
			<Group justify="space-between" align="center" wrap="nowrap">
				<Title order={2} size="h4">
					Municípios no ano
				</Title>
				<Tooltip label={asTable ? "Ver mapa" : "Ver tabela"}>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="md"
						onClick={() => setAsTable((t) => !t)}
						aria-label={asTable ? "Ver mapa" : "Ver tabela"}
					>
						{asTable ? <MapTrifoldIcon size={16} /> : <TableIcon size={16} />}
					</ActionIcon>
				</Tooltip>
			</Group>
			<Text size="sm" c="dimmed">
				Cada círculo é um município de {stateName} com focos desde 1º de janeiro
				(satélite de referência): o tamanho é o número de focos, a cor compara
				com a média do mesmo período desde 2003.
				{circles.length >= MAX_CIRCLES &&
					` Mostra os ${MAX_CIRCLES} com mais focos.`}
			</Text>
			{asTable ? (
				<ScrollArea.Autosize mah={360}>
					<Table {...COMPACT_TABLE}>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Município</Table.Th>
								<Table.Th ta="right">Focos no ano</Table.Th>
								<Table.Th ta="right">vs. média</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{circles.map((c) => (
								<Table.Tr key={c.slug}>
									<Table.Td>
										<MunicipalityLink uf={uf} name={c.name}>
											{c.name}
										</MunicipalityLink>
									</Table.Td>
									<Table.Td ta="right">{NUMBER.format(c.current)}</Table.Td>
									<Table.Td ta="right">
										{c.ratio === null ? "—" : percentVsAverage(c.ratio)}
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</ScrollArea.Autosize>
			) : (
				<>
					<Box
						component="svg"
						viewBox={`0 0 ${map.width} ${map.height}`}
						role="img"
						aria-label={`Municípios de ${stateName} por focos no ano; o maior é ${circles[0] ? label(circles[0]) : "nenhum"}. Use "Ver tabela" para os valores.`}
						w="100%"
						style={{
							display: "block",
							height: "auto",
							border: "1px solid var(--mantine-color-default-border)",
							borderRadius: "var(--mantine-radius-md)",
						}}
					>
						<path
							d={map.states}
							fill="none"
							stroke="var(--mantine-color-default-border)"
							strokeWidth={1}
						/>
						<path
							d={map.selected}
							fill="none"
							stroke="var(--mantine-color-dimmed)"
							strokeWidth={1.5}
						/>
						{circles.map((c) => (
							<Tooltip key={c.slug} label={label(c)} withArrow openDelay={0}>
								<Link
									to="/states/$state/$city"
									params={{ state: uf.toLowerCase(), city: c.slug }}
									aria-label={label(c)}
								>
									<circle
										cx={c.x}
										cy={c.y}
										r={c.r}
										fill={`var(--anom-${c.step})`}
										// The grey midpoint is close to the page's surface: outline it.
										stroke={
											c.step === 0
												? "var(--mantine-color-dimmed)"
												: "var(--mantine-color-body)"
										}
										strokeWidth={1}
									/>
								</Link>
							</Tooltip>
						))}
					</Box>
					<Group gap="sm" wrap="wrap">
						{ANOMALY_STEPS.map((s) => (
							<Group key={s.step} gap={6} wrap="nowrap">
								<Box
									w={12}
									h={12}
									bg={`var(--anom-${s.step})`}
									style={{
										borderRadius: 6,
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
				</>
			)}
		</Stack>
	);
}
