import {
	Anchor,
	Container,
	Group,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { HistorySection } from "~/features/history/components/HistorySection";
import { PageHeader } from "~/features/places/components/PageHeader";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { StateLink } from "~/features/places/components/RegionLinks";
import { getStatesSummary } from "~/features/places/regions.functions";
import { absoluteUrl } from "~/lib/site";

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
		<Container component="main" size="md" px={{ base: "sm", sm: "md" }} py="md">
			<Stack gap="md">
				<PageHeader />
				<Title order={1} size="h2">
					Focos de calor por estado
				</Title>
				<Text c="dimmed">
					{regionSentence("No Brasil", summary)} Escolha um estado para ver o
					mapa, os municípios e os maiores fogos, ou veja{" "}
					<Anchor renderRoot={(props) => <Link {...props} to="/biomes" />}>
						por bioma
					</Anchor>
					.
				</Text>
				<Table striped highlightOnHover>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Estado</Table.Th>
							<Table.Th ta="right">Fogos (estimativa)</Table.Th>
							<Table.Th ta="right">Focos</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{summary.states.map((s) => (
							<Table.Tr key={s.uf}>
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
		</Container>
	);
}
