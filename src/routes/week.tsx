import {
	Anchor,
	Container,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	percentVsAverage,
	versusAverage,
	weekLabel,
} from "~/features/history/format";
import { getWeek } from "~/features/history/history.functions";
import { FIRST_YEAR, type WeekRow } from "~/features/history/schemas";
import { PageHeader } from "~/features/places/components/PageHeader";
import { absoluteUrl } from "~/lib/site";

const NUMBER = new Intl.NumberFormat("pt-BR");
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;
/** "+12%" against the week before, or "novo" when it had none. */
const vsPrevious = (r: WeekRow) =>
	r.previous > 0
		? percentVsAverage(r.current / r.previous)
		: r.current
			? "novo"
			: "—";
const vsAverage = (r: WeekRow) =>
	r.refAverage > 0 ? percentVsAverage(r.ref / r.refAverage) : "—";

/** /week: the last 7 closed days, against the week before and past years. */
export const Route = createFileRoute("/week")({
	loader: () => getWeek(),
	head: ({ loaderData }) => {
		const title = loaderData
			? `Focos de calor de ${weekLabel(loaderData.from, loaderData.through)} · FocosBR`
			: "Focos de calor na semana · FocosBR";
		return {
			meta: [
				{ title },
				{
					name: "description",
					content:
						"Os focos de calor dos últimos 7 dias no Brasil, por estado, bioma e município, comparados com a semana anterior e com os anos desde 2003, com dados do INPE.",
				},
				{ property: "og:title", content: title },
				{ property: "og:image", content: absoluteUrl("/og/week") },
				{ name: "twitter:card", content: "summary_large_image" },
			],
			links: [{ rel: "canonical", href: absoluteUrl("/week") }],
		};
	},
	component: WeekPage,
});

function RowTable({
	title,
	rows,
	columns,
}: {
	title: string;
	rows: WeekRow[];
	columns: { head: string; value: (r: WeekRow) => ReactNode }[];
}) {
	return (
		<Stack gap={4}>
			<Title order={2} size="h4">
				{title}
			</Title>
			<Table striped highlightOnHover style={NUMERIC}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Lugar</Table.Th>
						{columns.map((c) => (
							<Table.Th key={c.head} ta="right">
								{c.head}
							</Table.Th>
						))}
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{rows.map((r) => (
						<Table.Tr key={r.key}>
							<Table.Td>
								<Anchor renderRoot={(props) => <Link {...props} to={r.path} />}>
									{r.name}
								</Anchor>
							</Table.Td>
							{columns.map((c) => (
								<Table.Td key={c.head} ta="right">
									{c.value(r)}
								</Table.Td>
							))}
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Stack>
	);
}

const COLUMNS = [
	{ head: "Focos", value: (r: WeekRow) => NUMBER.format(r.current) },
	{ head: "vs. semana anterior", value: vsPrevious },
	{ head: "vs. média", value: vsAverage },
];

function WeekPage() {
	const week = Route.useLoaderData();
	if (!week)
		return (
			<Container
				component="main"
				size="md"
				px={{ base: "sm", sm: "md" }}
				py="md"
			>
				<PageHeader />
				<Text>O resumo da semana está indisponível no momento.</Text>
			</Container>
		);
	const brazil = week.regions.find((r) => r.kind === "country");
	const states = week.regions.filter((r) => r.kind === "state");
	const biomes = week.regions.filter((r) => r.kind === "biome");
	return (
		<Container component="main" size="md" px={{ base: "sm", sm: "md" }} py="md">
			<Stack gap="lg">
				<PageHeader />
				<Stack gap={4}>
					<Title order={1} size="h2">
						Semana de {weekLabel(week.from, week.through)}
					</Title>
					{brazil && (
						<Text>
							No Brasil, <b>{NUMBER.format(brazil.current)} focos</b> detectados
							por todos os satélites,{" "}
							{brazil.previous > 0 && (
								<>
									<b>{vsPrevious(brazil)}</b> em relação à semana anterior (
									{NUMBER.format(brazil.previous)}).{" "}
								</>
							)}
							{brazil.refAverage > 0 && (
								<>
									Pelo satélite de referência, {NUMBER.format(brazil.ref)}{" "}
									focos, <b>{versusAverage(brazil.ref / brazil.refAverage)}</b>{" "}
									dessa semana desde {FIRST_YEAR} (
									{NUMBER.format(Math.round(brazil.refAverage))}).
								</>
							)}
						</Text>
					)}
					<Text size="sm" c="dimmed">
						Os últimos 7 dias fechados, no horário de Brasília. “vs. média”
						compara o satélite de referência com os mesmos dias de cada ano
						desde {FIRST_YEAR}; as outras colunas contam todos os satélites,
						como o mapa. Um foco é uma detecção de satélite, não um incêndio
						confirmado.
					</Text>
				</Stack>
				<RowTable title="Estados" rows={states} columns={COLUMNS} />
				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
					<RowTable
						title="Municípios com mais focos"
						rows={week.topCities}
						columns={COLUMNS.slice(0, 2)}
					/>
					<RowTable
						title="Municípios que mais subiram"
						rows={week.risingCities}
						columns={[
							{ head: "Focos", value: (r) => NUMBER.format(r.current) },
							{
								head: "Semana anterior",
								value: (r) => NUMBER.format(r.previous),
							},
						]}
					/>
				</SimpleGrid>
				<RowTable title="Biomas" rows={biomes} columns={COLUMNS} />
				<Text size="xs" c="dimmed">
					Atualizado toda manhã. Dados: INPE, Programa Queimadas. Veja também os{" "}
					<Anchor
						renderRoot={(props) => <Link {...props} to="/alerts" />}
						size="xs"
					>
						alertas
					</Anchor>{" "}
					e os{" "}
					<Anchor
						renderRoot={(props) => <Link {...props} to="/rankings" />}
						size="xs"
					>
						rankings do ano
					</Anchor>
					.
				</Text>
			</Stack>
		</Container>
	);
}
