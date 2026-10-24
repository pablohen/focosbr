import { Anchor, Box, Group, Stack, Text } from "@mantine/core";
import { FireIcon } from "@phosphor-icons/react";
import { SeasonChart } from "~/features/history/components/SeasonChart";
import { versusAverage } from "~/features/history/format";
import { FIRST_YEAR } from "~/features/history/schemas";
import { absoluteUrl } from "~/lib/site";
import type { getEmbed } from "../regions.functions";

export type Embed = NonNullable<Awaited<ReturnType<typeof getEmbed>>>;

const NUMBER = new Intl.NumberFormat("pt-BR");

/** `<head>` for an embed: out of search results, pointing at the full page. */
export function embedHead(embed: Embed | undefined) {
	if (!embed) return {};
	return {
		meta: [
			{ title: `Focos de calor: ${embed.name} · FocosBR` },
			{ name: "robots", content: "noindex" },
		],
		links: [{ rel: "canonical", href: absoluteUrl(embed.path) }],
	};
}

/** The iframe code for a region's widget. */
export function embedCode(embedPath: string, name: string) {
	return `<iframe src="${absoluteUrl(embedPath)}" title="Focos de calor: ${name} · FocosBR" width="100%" height="480" style="border:0;max-width:640px" loading="lazy"></iframe>`;
}

/**
 * The embeddable widget: a region's live numbers, this year against the
 * average and the season curve, in a frame other sites can paste into an
 * article. Links open the full page in a new tab.
 */
export function EmbedCard({ embed }: { embed: Embed }) {
	const page = absoluteUrl(embed.path);
	const ytd = embed.history?.ytd;
	return (
		<Box component="main" p="sm" maw={640}>
			<Stack gap="sm">
				<Group gap={8} wrap="nowrap">
					<FireIcon
						size={22}
						weight="duotone"
						color="var(--mantine-primary-color-filled)"
						aria-hidden
					/>
					<Anchor
						href={page}
						target="_blank"
						rel="noopener"
						fw={700}
						c="inherit"
					>
						Focos de calor: {embed.name}
					</Anchor>
				</Group>
				<Stack gap={2}>
					<Group gap={8} align="baseline" wrap="nowrap">
						<Text fz={34} fw={700} lh={1}>
							≈ {NUMBER.format(embed.fires)}
						</Text>
						<Text fw={600}>{embed.fires === 1 ? "fogo" : "fogos"}</Text>
					</Group>
					<Text size="sm" c="dimmed">
						{NUMBER.format(embed.total)}{" "}
						{embed.total === 1 ? "foco detectado" : "focos detectados"} por
						satélite nas últimas {embed.hours} horas
					</Text>
					{ytd && ytd.ratio !== null && (
						<Text size="sm">
							No ano: <b>{NUMBER.format(ytd.current)} focos</b>,{" "}
							{versusAverage(ytd.ratio)} do mesmo período desde {FIRST_YEAR}.
						</Text>
					)}
				</Stack>
				{embed.history && (
					<SeasonChart season={embed.history.season} firstYear={FIRST_YEAR} />
				)}
				<Text size="xs" c="dimmed">
					Um foco é uma detecção de satélite, não um incêndio confirmado. Dados:
					INPE, Programa Queimadas.{" "}
					<Anchor href={page} target="_blank" rel="noopener" size="xs">
						Ver mais no FocosBR
					</Anchor>
				</Text>
			</Stack>
		</Box>
	);
}
