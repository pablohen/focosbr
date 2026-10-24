import { Anchor, Group, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Window } from "../../fires/schemas";
import type { RegionCount } from "../places";
import { MunicipalityLink, StateLink } from "./RegionLinks";

const NUMBER = new Intl.NumberFormat("pt-BR");

type Numbers = { fires: number; total: number; hours: Window };

/** "cerca de 2.461 fogos (14.675 focos de calor) nas últimas 24 horas". */
function numbers({ fires, total, hours }: Numbers): string {
	return `cerca de ${NUMBER.format(fires)} ${fires === 1 ? "fogo" : "fogos"} (${NUMBER.format(total)} ${total === 1 ? "foco" : "focos"} de calor) nas últimas ${hours} horas`;
}

/** One sentence for meta descriptions and the intro. */
export function regionSentence(where: string, n: Numbers): string {
	return n.total === 0
		? `Nenhum foco de calor detectado por satélite em ${where} nas últimas ${n.hours} horas, segundo o INPE.`
		: `${where}: ${numbers(n)}, segundo o INPE.`;
}

function Links({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Stack gap={2}>
			<Text size="xs" fw={600}>
				{label}
			</Text>
			<Group gap={6} style={{ rowGap: 2 }}>
				{children}
			</Group>
		</Stack>
	);
}

export function BrazilIntro({
	summary,
}: {
	summary: Numbers & { states: RegionCount[] };
}) {
	const top = summary.states.filter((s) => s.total > 0).slice(0, 8);
	return (
		<Stack gap={6}>
			<Text size="sm">{regionSentence("No Brasil", summary)}</Text>
			{top.length > 0 && (
				<Links label="Estados com mais focos">
					{top.map((s) => (
						<StateLink key={s.uf} uf={s.uf} hours={summary.hours} size="xs">
							{s.name} ({NUMBER.format(s.total)})
						</StateLink>
					))}
					<Anchor component={Link} to="/states" size="xs">
						todos os estados
					</Anchor>
				</Links>
			)}
		</Stack>
	);
}

export function StateIntro({
	summary,
}: {
	summary: Numbers & {
		uf: string;
		name: string;
		municipalities: RegionCount[];
	};
}) {
	return (
		<Stack gap={6}>
			<Text size="sm">{regionSentence(summary.name, summary)}</Text>
			{summary.municipalities.length > 0 && (
				<Links label="Municípios com mais focos">
					{summary.municipalities.map((m) => (
						<MunicipalityLink
							key={m.name}
							uf={m.uf}
							name={m.name}
							hours={summary.hours}
							size="xs"
						>
							{m.name} ({NUMBER.format(m.total)})
						</MunicipalityLink>
					))}
				</Links>
			)}
			<Anchor component={Link} to="/states" size="xs">
				Ver todos os estados
			</Anchor>
		</Stack>
	);
}

export function MunicipalityIntro({
	summary,
}: {
	summary: Numbers & { uf: string; stateName: string; label: string };
}) {
	return (
		<Stack gap={6}>
			<Text size="sm">{regionSentence(summary.label, summary)}</Text>
			<StateLink uf={summary.uf} hours={summary.hours} size="xs">
				Ver {summary.stateName}
			</StateLink>
		</Stack>
	);
}
