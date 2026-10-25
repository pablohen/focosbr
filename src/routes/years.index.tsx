import { Anchor, Stack, Table, Text } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarSeries } from "~/features/fires/components/BarSeries";
import { getYear } from "~/features/history/history.functions";
import { FIRST_YEAR } from "~/features/history/schemas";
import { PageShell } from "~/features/places/components/PageShell";
import { PageTitle } from "~/features/places/components/PageTitle";
import { absoluteUrl } from "~/lib/site";
import { LIST_TABLE } from "~/lib/tables";

const NUMBER = new Intl.NumberFormat("pt-BR");
const TITLE = `Focos de calor por ano desde ${FIRST_YEAR} · FocosBR`;

/** /years: every year since 2003 (from the current year's summary), linking to each. */
export const Route = createFileRoute("/years/")({
	loader: async () => {
		// The current year's summary carries every year's total.
		const year = Number(
			new Intl.DateTimeFormat("en", {
				year: "numeric",
				timeZone: "America/Sao_Paulo",
			}).format(new Date()),
		);
		return (
			(await getYear({ data: { year } })) ??
			getYear({ data: { year: year - 1 } })
		);
	},
	head: () => ({
		meta: [
			{ title: TITLE },
			{
				name: "description",
				content: `Focos de calor no Brasil a cada ano desde ${FIRST_YEAR}, pelo satélite de referência do INPE, com os estados, biomas e municípios de cada ano.`,
			},
			{ property: "og:title", content: TITLE },
		],
		links: [{ rel: "canonical", href: absoluteUrl("/years") }],
	}),
	component: YearsPage,
});

function YearsPage() {
	const s = Route.useLoaderData();
	const totals = s?.totals ?? [];
	const lastYear = totals.at(-1)?.year;
	const partial = s ? s.through.slice(0, 4) === String(lastYear) : false;
	return (
		<PageShell>
			<Stack gap="lg">
				<PageTitle
					title="Focos de calor por ano"
					lead={`O Brasil a cada ano desde ${FIRST_YEAR}, pelo satélite de referência do INPE.`}
					note="É a série que permite comparar anos. Escolha um ano para ver os meses, estados, biomas e municípios."
				/>
				{totals.length === 0 ? (
					<Text>O histórico está indisponível no momento.</Text>
				) : (
					<>
						<BarSeries
							title="Focos por ano"
							bars={totals.map((t) => ({
								key: String(t.year),
								label: String(t.year),
								value: t.count,
								partial: partial && t.year === lastYear,
							}))}
						/>
						<Table {...LIST_TABLE}>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Ano</Table.Th>
									<Table.Th ta="right">Focos</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{[...totals].reverse().map((t) => (
									<Table.Tr key={t.year}>
										<Table.Td>
											<Anchor
												renderRoot={(props) => (
													<Link
														{...props}
														to="/years/$year"
														params={{ year: String(t.year) }}
													/>
												)}
											>
												{t.year}
											</Anchor>
											{partial && t.year === lastYear && " (até agora)"}
										</Table.Td>
										<Table.Td ta="right">{NUMBER.format(t.count)}</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</>
				)}
			</Stack>
		</PageShell>
	);
}
