import { Anchor, Stack, Text } from "@mantine/core";
import { RssIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { alertText } from "~/features/history/alerts";
import { getAlerts } from "~/features/history/history.functions";
import { FIRST_YEAR } from "~/features/history/schemas";
import { PageShell } from "~/features/places/components/PageShell";
import { PageTitle } from "~/features/places/components/PageTitle";
import { absoluteUrl } from "~/lib/site";

const TITLE = "Alertas · FocosBR";
const WHEN = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "America/Sao_Paulo",
});

/** /alerts: places above double their average, and record days, newest first. */
export const Route = createFileRoute("/alerts")({
	loader: () => getAlerts(),
	head: () => ({
		meta: [
			{ title: TITLE },
			{
				name: "description",
				content:
					"Municípios, estados e biomas que passam do dobro da média de focos de calor no ano, e dias recordes, com dados do INPE. Também em RSS.",
			},
			{ property: "og:title", content: TITLE },
		],
		links: [
			{ rel: "canonical", href: absoluteUrl("/alerts") },
			{
				rel: "alternate",
				type: "application/rss+xml",
				title: "FocosBR · Alertas",
				href: absoluteUrl("/feed.xml"),
			},
		],
	}),
	component: AlertsPage,
});

function AlertsPage() {
	const alerts = Route.useLoaderData();
	return (
		<PageShell>
			<Stack gap="lg">
				<PageTitle
					title="Alertas"
					lead={`Quando um município, estado ou bioma passa do dobro da média de focos do ano, ou quando um estado, bioma ou o Brasil tem o dia com mais focos desde ${FIRST_YEAR}.`}
					note="Só lugares com média de ao menos 50 focos no período. Conta o satélite de referência do INPE; atualizado toda manhã."
				>
					<Anchor href="/feed.xml" size="sm" w="fit-content" py={4}>
						<RssIcon size={14} style={{ verticalAlign: "-2px" }} /> Assinar por
						RSS
					</Anchor>
				</PageTitle>
				{alerts === null ? (
					<Text>Os alertas estão indisponíveis no momento.</Text>
				) : alerts.length === 0 ? (
					<Text>Nenhum alerta ainda.</Text>
				) : (
					<Stack
						gap="md"
						component="ol"
						m={0}
						p={0}
						style={{ listStyle: "none" }}
					>
						{alerts.map((a) => {
							const { title, summary } = alertText(a, FIRST_YEAR);
							return (
								<Stack key={a._id} gap={2} component="li">
									<Text size="xs" c="dimmed">
										{WHEN.format(new Date(a.createdAt))}
									</Text>
									<Anchor
										fw={600}
										renderRoot={(props) => <Link {...props} to={a.path} />}
									>
										{title}
									</Anchor>
									<Text size="sm">{summary}</Text>
								</Stack>
							);
						})}
					</Stack>
				)}
				<Text size="xs" c="dimmed">
					Um foco é uma detecção de satélite, não um incêndio confirmado. Dados:
					INPE, Programa Queimadas.{" "}
					<Anchor
						renderRoot={(props) => <Link {...props} to="/data" />}
						size="xs"
					>
						Também em JSON
					</Anchor>
				</Text>
			</Stack>
		</PageShell>
	);
}
