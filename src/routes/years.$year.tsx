import {
	Anchor,
	Container,
	Group,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BarSeries } from "~/features/fires/components/BarSeries";
import { yearSentence } from "~/features/history/format";
import { getYear } from "~/features/history/history.functions";
import { FIRST_YEAR, type YearRow } from "~/features/history/schemas";
import { PageHeader } from "~/features/places/components/PageHeader";
import { absoluteUrl } from "~/lib/site";

const NUMBER = new Intl.NumberFormat("pt-BR");
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;
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

/** /years/2024: one year of INPE's reference satellite, ranked. */
export const Route = createFileRoute("/years/$year")({
	loader: async ({ params }) => {
		const year = Number(params.year);
		if (!Number.isInteger(year) || year < FIRST_YEAR) throw notFound();
		const summary = await getYear({ data: { year } });
		if (!summary) throw notFound();
		return summary;
	},
	head: ({ loaderData }) => {
		if (!loaderData) return {};
		const title = `Focos de calor em ${loaderData.year} · FocosBR`;
		return {
			meta: [
				{ title },
				{ name: "description", content: yearSentence(loaderData, FIRST_YEAR) },
				{ property: "og:title", content: title },
				{
					property: "og:image",
					content: absoluteUrl(`/og/years/${loaderData.year}`),
				},
				{ name: "twitter:card", content: "summary_large_image" },
			],
			links: [
				{ rel: "canonical", href: absoluteUrl(`/years/${loaderData.year}`) },
			],
		};
	},
	component: YearPage,
});

function YearTable({ title, rows }: { title: string; rows: YearRow[] }) {
	return (
		<Stack gap={4}>
			<Title order={2} size="h4">
				{title}
			</Title>
			<Table striped highlightOnHover style={NUMERIC}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th w={32} ta="right">
							#
						</Table.Th>
						<Table.Th>Nome</Table.Th>
						<Table.Th ta="right">Focos</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{rows.map((r, i) => (
						<Table.Tr key={r.key}>
							<Table.Td ta="right" c="dimmed">
								{i + 1}
							</Table.Td>
							<Table.Td>
								<Anchor renderRoot={(props) => <Link {...props} to={r.path} />}>
									{r.name}
								</Anchor>
							</Table.Td>
							<Table.Td ta="right">{NUMBER.format(r.count)}</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Stack>
	);
}

function YearPage() {
	const s = Route.useLoaderData();
	const last = s.totals.at(-1)?.year ?? s.year;
	return (
		<Container component="main" size="md" px={{ base: "sm", sm: "md" }} py="md">
			<Stack gap="lg">
				<PageHeader />
				<Stack gap={4}>
					<Group justify="space-between">
						<Anchor
							renderRoot={(props) => <Link {...props} to="/years" />}
							size="sm"
						>
							Todos os anos
						</Anchor>
						<Group gap="md">
							{s.year > FIRST_YEAR && (
								<Anchor
									size="sm"
									renderRoot={(props) => (
										<Link
											{...props}
											to="/years/$year"
											params={{ year: String(s.year - 1) }}
										/>
									)}
								>
									← {s.year - 1}
								</Anchor>
							)}
							{s.year < last && (
								<Anchor
									size="sm"
									renderRoot={(props) => (
										<Link
											{...props}
											to="/years/$year"
											params={{ year: String(s.year + 1) }}
										/>
									)}
								>
									{s.year + 1} →
								</Anchor>
							)}
						</Group>
					</Group>
					<Title order={1} size="h2">
						Focos de calor em {s.year}
					</Title>
					<Text>{yearSentence(s, FIRST_YEAR)}</Text>
				</Stack>
				<BarSeries
					title="Por ano (satélite de referência)"
					bars={s.totals.map((t) => ({
						key: String(t.year),
						label: String(t.year),
						value: t.count,
						partial: t.year === last && s.through.slice(0, 4) === String(last),
					}))}
				/>
				<BarSeries
					title={`Por mês em ${s.year}`}
					bars={s.months.map((count, m) => ({
						key: MONTHS[m] ?? String(m),
						label: `${MONTHS[m]} ${s.year}`,
						value: count,
						partial: s.partial && m + 1 === Number(s.through.slice(5, 7)),
					}))}
				/>
				<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
					<YearTable title="Estados" rows={s.states} />
					<Stack gap="lg">
						<YearTable title="Biomas" rows={s.biomes} />
						<YearTable title="Municípios com mais focos" rows={s.cities} />
					</Stack>
				</SimpleGrid>
				<Text size="xs" c="dimmed">
					Só o satélite de referência do INPE (AQUA, passagem da tarde), a série
					que permite comparar anos. Meses no horário de Brasília. Um foco é uma
					detecção de satélite, não um incêndio confirmado. Dados: INPE,
					Programa Queimadas.
				</Text>
			</Stack>
		</Container>
	);
}
