import { Anchor, Group, Stack, Table, Text } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { HistorySection } from "~/features/history/components/HistorySection";
import { PageShell } from "~/features/places/components/PageShell";
import { PageTitle } from "~/features/places/components/PageTitle";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { StateLink } from "~/features/places/components/RegionLinks";
import { getStatesSummary } from "~/features/places/regions.functions";
import { absoluteUrl } from "~/lib/site";
import { LIST_TABLE } from "~/lib/tables";

const NUMBER = new Intl.NumberFormat("pt-BR");
const TITLE = "Focos de calor por estado · FocosBR";

/** /states: every state with its current numbers, linking to its page, and Brazil's history. */
export const Route = createFileRoute("/states/")({
	validateSearch: z.object({ h: WindowSchema.optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ h: search.h ?? 24 }),
	loader: ({ deps }) => getStatesSummary({ data: { h: deps.h } }),
	head: ({ loaderData }) => ({
		meta: [
			{ title: TITLE },
			{
				name: "description",
				content: loaderData
					? regionSentence("No Brasil", loaderData)
					: "Focos de calor por estado, com dados do INPE.",
			},
			{ property: "og:title", content: TITLE },
		],
		links: [{ rel: "canonical", href: absoluteUrl("/states") }],
	}),
	component: StatesPage,
});

function StatesPage() {
	const summary = Route.useLoaderData();
	return (
		<PageShell>
			<Stack gap="md">
				<PageTitle
					title="Focos de calor por estado"
					lead={regionSentence("No Brasil", summary)}
					note={
						<>
							Escolha um estado para ver o mapa, os municípios e os maiores
							fogos, ou veja{" "}
							<Anchor
								renderRoot={(props) => <Link {...props} to="/biomes" />}
								size="sm"
							>
								por bioma
							</Anchor>
							.
						</>
					}
				/>
				<Table {...LIST_TABLE}>
					<Table.Thead>
						<Table.Tr>
							<Table.Th w={32} ta="right">
								#
							</Table.Th>
							<Table.Th>Estado</Table.Th>
							<Table.Th ta="right">Fogos (estimativa)</Table.Th>
							<Table.Th ta="right">Focos</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{summary.states.map((s, i) => (
							<Table.Tr key={s.uf}>
								<Table.Td ta="right" c="dimmed">
									{i + 1}
								</Table.Td>
								<Table.Td>
									<StateLink uf={s.uf} hours={summary.hours}>
										{s.name}
									</StateLink>
								</Table.Td>
								<Table.Td
									ta="right"
									style={{ fontVariantNumeric: "tabular-nums" }}
								>
									{NUMBER.format(s.fires)}
								</Table.Td>
								<Table.Td
									ta="right"
									style={{ fontVariantNumeric: "tabular-nums" }}
								>
									{NUMBER.format(s.total)}
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
				{summary.history && (
					<HistorySection
						history={summary.history}
						name="No Brasil"
						fileName="Brasil"
					/>
				)}
				<Group gap="xs">
					<Text size="xs" c="dimmed">
						Últimas {summary.hours} horas. Dados: INPE, Programa Queimadas.
					</Text>
				</Group>
			</Stack>
		</PageShell>
	);
}
