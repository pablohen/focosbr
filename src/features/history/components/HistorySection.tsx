import { Stack, Text, Title } from "@mantine/core";
import { BarSeries } from "~/features/fires/components/BarSeries";
import type { RegionHistory } from "../schemas";

const NUMBER = new Intl.NumberFormat("pt-BR");
const MONTH = new Intl.DateTimeFormat("pt-BR", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "2-digit",
	timeZone: "UTC",
});
const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

/**
 * A region's history: every year since 2003 and the last 24 months from
 * INPE's reference satellite (comparable across years), and the last 90
 * days from all satellites. The current year, month and day are partial.
 */
export function HistorySection({
	history,
	name,
}: {
	history: RegionHistory;
	name: string;
}) {
	const { years, months, days } = history;
	const current = years.at(-1);
	const past = years.slice(0, -1);
	const average = past.length
		? Math.round(past.reduce((a, y) => a + y.count, 0) / past.length)
		: 0;
	const record = past.reduce(
		(a, y) => (y.count > a.count ? y : a),
		past[0] ?? { key: "", count: 0, partial: false },
	);
	return (
		<Stack gap="md">
			<Stack gap={4}>
				<Title order={2} size="h4">
					Histórico
				</Title>
				{current && (
					<Text size="sm">
						{name}: {NUMBER.format(current.count)}{" "}
						{current.count === 1 ? "foco" : "focos"} em {current.key} até agora
						pelo satélite de referência; média de {NUMBER.format(average)} por
						ano desde {years[0]?.key}
						{record.count > 0 &&
							`, recorde de ${NUMBER.format(record.count)} em ${record.key}`}
						.
					</Text>
				)}
			</Stack>
			<BarSeries
				title="Por ano (satélite de referência)"
				bars={years.map((y) => ({
					key: y.key,
					label: y.key,
					value: y.count,
					partial: y.partial,
				}))}
			/>
			<BarSeries
				title="Últimos 24 meses (satélite de referência)"
				bars={months.map((m) => ({
					key: m.key,
					label: MONTH.format(Date.parse(`${m.key}-01T00:00:00Z`)),
					value: m.count,
					partial: m.partial,
				}))}
			/>
			<BarSeries
				title="Últimos 90 dias (todos os satélites)"
				bars={days.map((d) => ({
					key: d.key,
					label: DAY.format(Date.parse(`${d.key}T00:00:00Z`)),
					value: d.count,
					partial: d.partial,
				}))}
			/>
			<Text size="xs" c="dimmed">
				Anos e meses contam só o satélite de referência do INPE (AQUA, passagem
				da tarde): é a série que permite comparar anos, já que o número de
				satélites mudou com o tempo. Os dias contam todos os satélites, como o
				mapa
				{history.daysSince &&
					` (com registros desde ${DATE.format(Date.parse(`${history.daysSince}T00:00:00Z`))})`}
				. Datas no horário de Brasília; atualizado diariamente.
			</Text>
		</Stack>
	);
}
