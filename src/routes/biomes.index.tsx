import { Stack, Table, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { PageShell } from "~/features/places/components/PageShell";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { BiomeLink } from "~/features/places/components/RegionLinks";
import { getBiomesSummary } from "~/features/places/regions.functions";
import { absoluteUrl } from "~/lib/site";
import { LIST_TABLE } from "~/lib/tables";

const NUMBER = new Intl.NumberFormat("pt-BR");
const TITLE = "Focos de calor por bioma · FocosBR";
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/** /biomes: Brazil's six biomes with their current numbers, linking to their pages. */
export const Route = createFileRoute("/biomes/")({
	validateSearch: z.object({ h: WindowSchema.optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: ({ deps }) => getBiomesSummary({ data: { h: deps.h } }),
	head: ({ loaderData }) => ({
		meta: [
			{ title: TITLE },
			{
				name: "description",
				content: loaderData
					? `${regionSentence("No Brasil", loaderData)} Focos por bioma: Amazônia, Cerrado, Caatinga, Mata Atlântica, Pantanal e Pampa.`
					: "Focos de calor por bioma, com dados do INPE.",
			},
			{ property: "og:title", content: TITLE },
		],
		links: [{ rel: "canonical", href: absoluteUrl("/biomes") }],
	}),
	component: BiomesPage,
});

function BiomesPage() {
	const summary = Route.useLoaderData();
	return (
		<PageShell>
			<Stack gap="md">
				<Title order={1} size="h2">
					Focos de calor por bioma
				</Title>
				<Text c="dimmed">
					{regionSentence("No Brasil", summary)} Escolha um bioma para ver o
					mapa, os municípios, os maiores fogos e o histórico desde 2003.
				</Text>
				<Table {...LIST_TABLE}>
					<Table.Thead>
						<Table.Tr>
							<Table.Th w={32} ta="right">
								#
							</Table.Th>
							<Table.Th>Bioma</Table.Th>
							<Table.Th ta="right">Fogos (estimativa)</Table.Th>
							<Table.Th ta="right">Focos</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{summary.biomes.map((b, i) => (
							<Table.Tr key={b.slug}>
								<Table.Td ta="right" c="dimmed">
									{i + 1}
								</Table.Td>
								<Table.Td>
									<BiomeLink slug={b.slug} hours={summary.hours}>
										{b.name}
									</BiomeLink>
								</Table.Td>
								<Table.Td ta="right" style={NUMERIC}>
									{NUMBER.format(b.fires)}
								</Table.Td>
								<Table.Td ta="right" style={NUMERIC}>
									{NUMBER.format(b.total)}
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
				<Text size="xs" c="dimmed">
					Últimas {summary.hours} horas. Focos preliminares e os do litoral e de
					fronteira, sem bioma, não entram em nenhum. Dados: INPE, Programa
					Queimadas.
				</Text>
			</Stack>
		</PageShell>
	);
}
