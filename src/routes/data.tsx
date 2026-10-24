import {
	Anchor,
	Code,
	Container,
	List,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "~/features/places/components/PageHeader";
import { absoluteUrl, SITE_URL } from "~/lib/site";

const TITLE = "Dados abertos · FocosBR";

/** /data: how to reuse FocosBR's data (the JSON API, downloads, the feed). */
export const Route = createFileRoute("/data")({
	head: () => ({
		meta: [
			{ title: TITLE },
			{
				name: "description",
				content:
					"API JSON aberta com o histórico de focos de calor desde 2003 por estado, município e bioma, e os focos das últimas horas, com dados do INPE.",
			},
			{ property: "og:title", content: TITLE },
		],
		links: [{ rel: "canonical", href: absoluteUrl("/data") }],
	}),
	component: DataPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Stack gap="xs">
			<Title order={2} size="h4">
				{title}
			</Title>
			{children}
		</Stack>
	);
}

const KEYS = [
	["br", "Brasil"],
	["pa", "um estado, pela sigla"],
	["pa/altamira", "um município: sigla e nome do IBGE sem acentos"],
	["biome/amazonia", "um bioma"],
];

const FIELDS = [
	[
		"history.ytd",
		"Do 1º de janeiro até ontem, comparado com o mesmo período de cada ano desde 2003",
	],
	[
		"history.season",
		"Acumulado no ano, a cada 7 dias: este ano, mínimo, máximo, média e ano recorde",
	],
	["history.years", "Focos por ano (satélite de referência)"],
	[
		"history.calendar",
		"Focos por mês, um item por ano (satélite de referência)",
	],
	["history.months", "Últimos 24 meses (satélite de referência)"],
	["history.days", "Últimos 90 dias (todos os satélites)"],
];

function DataPage() {
	return (
		<Container component="main" size="md" px={{ base: "sm", sm: "md" }} py="md">
			<Stack gap="lg">
				<PageHeader />
				<Stack gap={4}>
					<Title order={1} size="h2">
						Dados abertos
					</Title>
					<Text c="dimmed">
						Os dados do FocosBR vêm do Programa Queimadas do INPE e podem ser
						reusados livremente, citando a fonte: “Focos de calor: INPE,
						Programa Queimadas. Processado por FocosBR.” Um foco é uma detecção
						de satélite, não um incêndio confirmado.
					</Text>
				</Stack>

				<Section title="Histórico por região">
					<Code block>{`GET ${SITE_URL}/api/history/<região>`}</Code>
					<Table withTableBorder={false} fz="sm" verticalSpacing={4}>
						<Table.Tbody>
							{KEYS.map(([key, what]) => (
								<Table.Tr key={key}>
									<Table.Td>
										<Anchor
											href={`/api/history/${key}`}
											ff="monospace"
											size="sm"
										>
											{key}
										</Anchor>
									</Table.Td>
									<Table.Td>{what}</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
					<Text size="sm">
						A resposta traz a região, a atribuição e as séries que as páginas
						desenham:
					</Text>
					<List size="sm" spacing={2}>
						{FIELDS.map(([field, what]) => (
							<List.Item key={field}>
								<Code>{field}</Code>: {what}
							</List.Item>
						))}
					</List>
					<Text size="sm">
						Anos e meses contam só o satélite de referência do INPE (AQUA,
						passagem da tarde), a série que permite comparar anos. Datas no
						horário de Brasília. Atualizado uma vez por dia; respostas em cache
						por uma hora. Liberado para leitura de qualquer site (CORS).
					</Text>
					<Code block>
						{`const res = await fetch("${SITE_URL}/api/history/pa");
const { region, history } = await res.json();
console.log(region.name, history.ytd.current, history.ytd.ratio);`}
					</Code>
				</Section>

				<Section title="Focos das últimas horas">
					<Code block>{`GET ${SITE_URL}/api/fires?h=6|24|48`}</Code>
					<Text size="sm">
						Todas as detecções da janela em colunas (o mesmo que o mapa usa),
						atualizadas a cada 5 minutos. Para planilhas, prefira o botão de
						download do mapa, que gera CSV ou GeoJSON da vista atual.
					</Text>
				</Section>

				<Section title="Alertas">
					<Code
						block
					>{`GET ${SITE_URL}/api/alerts\nGET ${SITE_URL}/feed.xml`}</Code>
					<Text size="sm">
						Os{" "}
						<Anchor renderRoot={(props) => <Link {...props} to="/alerts" />}>
							alertas
						</Anchor>{" "}
						(lugares acima do dobro da média do ano e dias recordes) em JSON ou
						RSS, os mais recentes primeiro. Gerados toda manhã.
					</Text>
				</Section>

				<Section title="Planilhas">
					<Text size="sm">
						Cada página de estado, município e bioma tem um menu “Baixar CSV”
						com as séries do histórico, e um botão “Incorporar” com o código
						para mostrar o gráfico em outro site.
					</Text>
				</Section>
			</Stack>
		</Container>
	);
}
