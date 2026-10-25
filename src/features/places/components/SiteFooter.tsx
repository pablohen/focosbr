import { Anchor, Box, Container, SimpleGrid, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";

const GROUPS = [
	{
		title: "Explorar",
		links: [
			{ to: "/", label: "Mapa" },
			{ to: "/states", label: "Estados" },
			{ to: "/biomes", label: "Biomas" },
			{ to: "/compare", label: "Comparar lugares" },
		],
	},
	{
		title: "No ano",
		links: [
			{ to: "/rankings", label: "Rankings" },
			{ to: "/week", label: "Resumo da semana" },
			{ to: "/years", label: "Por ano" },
			{ to: "/alerts", label: "Alertas" },
		],
	},
	{
		title: "Dados",
		links: [
			{ to: "/data", label: "Dados abertos e API" },
			{ href: "/feed.xml", label: "Alertas por RSS" },
		],
	},
] as const;

/**
 * Every content page's footer: all the site's sections (the header only
 * has room for a few), the data source and what a "foco" is.
 */
export function SiteFooter() {
	return (
		<Box
			component="footer"
			mt="xl"
			py="lg"
			style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
		>
			<Container size="md" px={{ base: "sm", sm: "md" }}>
				<Stack gap="lg">
					<SimpleGrid cols={{ base: 2, sm: 3 }} spacing="lg">
						{GROUPS.map((g) => (
							<Stack key={g.title} gap={4}>
								<Text size="sm" fw={700}>
									{g.title}
								</Text>
								{g.links.map((l) =>
									"to" in l ? (
										<Anchor
											key={l.label}
											size="sm"
											c="dimmed"
											py={4}
											renderRoot={(props) => <Link {...props} to={l.to} />}
										>
											{l.label}
										</Anchor>
									) : (
										<Anchor
											key={l.label}
											size="sm"
											c="dimmed"
											py={4}
											href={l.href}
										>
											{l.label}
										</Anchor>
									),
								)}
							</Stack>
						))}
					</SimpleGrid>
					<Text size="xs" c="dimmed">
						Um foco de calor é uma detecção de satélite, não um incêndio
						confirmado. Dados:{" "}
						<Anchor
							href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/"
							target="_blank"
							rel="noreferrer"
							size="xs"
						>
							INPE, Programa Queimadas
						</Anchor>
						. Horários de Brasília.
					</Text>
				</Stack>
			</Container>
		</Box>
	);
}
