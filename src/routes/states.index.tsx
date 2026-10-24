import {
	Anchor,
	Container,
	Group,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { FireIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { WindowSchema } from "~/features/fires/schemas";
import { regionSentence } from "~/features/places/components/RegionIntro";
import { StateLink } from "~/features/places/components/RegionLinks";
import { getStatesSummary } from "~/features/places/regions.functions";
import { absoluteUrl } from "~/lib/site";

const NUMBER = new Intl.NumberFormat("pt-BR");
const TITLE = "Focos de calor por estado · FocosBR";

/** /states: every state with its current numbers, linking to its page. */
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
		<Container size="sm" py="xl">
			<Stack gap="md">
				<Anchor
					component={Link}
					to="/"
					underline="never"
					c="inherit"
					style={{ display: "flex", alignItems: "center", gap: 8 }}
				>
					<FireIcon
						size={26}
						weight="duotone"
						color="var(--mantine-primary-color-filled)"
						aria-hidden
					/>
					<Text fw={700} fz="h4">
						FocosBR
					</Text>
				</Anchor>
				<Title order={1} size="h2">
					Focos de calor por estado
				</Title>
				<Text c="dimmed">
					{regionSentence("No Brasil", summary)} Escolha um estado para ver o
					mapa, os municípios e os maiores fogos.
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
				<Group gap="xs">
					<Text size="xs" c="dimmed">
						Últimas {summary.hours} horas. Dados: INPE, Programa Queimadas.
					</Text>
				</Group>
			</Stack>
		</Container>
	);
}
