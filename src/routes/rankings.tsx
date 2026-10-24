import { Container, Stack, Table, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { percentVsAverage, ytdPeriod } from "~/features/history/format";
import { getRankings } from "~/features/history/history.functions";
import {
	RANKING_MIN_AVERAGE,
	type RankingRow,
} from "~/features/history/schemas";
import { PageHeader } from "~/features/places/components/PageHeader";
import {
	MunicipalityLink,
	StateLink,
} from "~/features/places/components/RegionLinks";
import { placeLabel } from "~/features/places/places";
import { absoluteUrl } from "~/lib/site";

const NUMBER = new Intl.NumberFormat("pt-BR");
const TITLE = "Rankings de focos de calor no ano · FocosBR";
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * /rankings: this year so far, by state and by city, against the same
 * period of every year since 2003 (INPE's reference satellite). Rendered on
 * the server from the history collection's year-to-date summaries.
 */
export const Route = createFileRoute("/rankings")({
	loader: () => getRankings(),
	head: ({ loaderData }) => ({
		meta: [
			{ title: TITLE },
			{
				name: "description",
				content: loaderData
					? `Estados e municípios com mais focos de calor de ${ytdPeriod(loaderData.through)} de ${loaderData.through.slice(0, 4)}, e os que mais passam da própria média, com dados do INPE.`
					: "Estados e municípios com mais focos de calor no ano, com dados do INPE.",
			},
			{ property: "og:title", content: TITLE },
		],
		links: [{ rel: "canonical", href: absoluteUrl("/rankings") }],
	}),
	component: RankingsPage,
});

function RankingsPage() {
	const rankings = Route.useLoaderData();
	return (
		<Container component="main" size="md" px={{ base: "sm", sm: "md" }} py="md">
			<Stack gap="lg">
				<PageHeader />
				<Stack gap={4}>
					<Title order={1} size="h2">
						Rankings do ano
					</Title>
					{rankings ? (
						<Text c="dimmed">
							Focos de {ytdPeriod(rankings.through)} de{" "}
							{rankings.through.slice(0, 4)} pelo satélite de referência do
							INPE, comparados com a média do mesmo período desde{" "}
							{rankings.firstYear}.
						</Text>
					) : (
						<Text c="dimmed">
							Os rankings estão indisponíveis no momento. Tente de novo mais
							tarde.
						</Text>
					)}
				</Stack>
				{rankings && (
					<>
						<Ranking
							title="Estados"
							rows={rankings.states}
							name={(r) => <StateLink uf={r.uf}>{r.name}</StateLink>}
						/>
						<Ranking
							title="Municípios com mais focos"
							rows={rankings.cities}
							name={(r) => (
								<MunicipalityLink uf={r.uf} name={r.name}>
									{placeLabel(r.name, r.uf)}
								</MunicipalityLink>
							)}
						/>
						<Ranking
							title="Municípios mais acima da própria média"
							note={`Só municípios com média de ao menos ${RANKING_MIN_AVERAGE} focos no período; abaixo disso, poucos focos dão porcentagens enormes.`}
							rows={rankings.aboveAverage}
							name={(r) => (
								<MunicipalityLink uf={r.uf} name={r.name}>
									{placeLabel(r.name, r.uf)}
								</MunicipalityLink>
							)}
						/>
						<Text size="xs" c="dimmed">
							Um foco é uma detecção de satélite, não um incêndio confirmado. O
							satélite de referência (AQUA, passagem da tarde) é a série que
							permite comparar anos; o mapa conta todos os satélites. Atualizado
							diariamente, até o último dia fechado (horário de Brasília).
							Dados: INPE, Programa Queimadas.
						</Text>
					</>
				)}
			</Stack>
		</Container>
	);
}

function Ranking({
	title,
	note,
	rows,
	name,
}: {
	title: string;
	note?: string;
	rows: RankingRow[];
	name: (row: RankingRow) => ReactNode;
}) {
	return (
		<Stack gap={4}>
			<Title order={2} size="h4">
				{title}
			</Title>
			{note && (
				<Text size="xs" c="dimmed">
					{note}
				</Text>
			)}
			<Table striped highlightOnHover>
				<Table.Thead>
					<Table.Tr>
						<Table.Th w={32} ta="right">
							#
						</Table.Th>
						<Table.Th>Nome</Table.Th>
						<Table.Th ta="right">Focos</Table.Th>
						<Table.Th ta="right">Média</Table.Th>
						<Table.Th ta="right">vs. média</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{rows.map((r, i) => (
						<Table.Tr key={`${r.uf}/${r.name}`}>
							<Table.Td ta="right" c="dimmed" style={NUMERIC}>
								{i + 1}
							</Table.Td>
							<Table.Td>{name(r)}</Table.Td>
							<Table.Td ta="right" style={NUMERIC}>
								{NUMBER.format(r.current)}
							</Table.Td>
							<Table.Td ta="right" style={NUMERIC}>
								{NUMBER.format(Math.round(r.average))}
							</Table.Td>
							<Table.Td ta="right" style={NUMERIC}>
								{r.ratio === null ? "—" : percentVsAverage(r.ratio)}
							</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Stack>
	);
}
