import { Stack, Text, Title } from "@mantine/core";
import { BarSeries } from "~/features/fires/components/BarSeries";
import { versusAverage, ytdPeriod } from "../format";
import type { RegionHistory, Ytd } from "../schemas";
import { FireCalendar } from "./FireCalendar";

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
const focos = (n: number) =>
	`${NUMBER.format(n)} ${n === 1 ? "foco" : "focos"}`;

function YtdSentence({ ytd, name }: { ytd: Ytd; name: string }) {
	const year = ytd.through.slice(0, 4);
	return (
		<Text size="sm">
			{name}, de {ytdPeriod(ytd.through)} de {year}: <b>{focos(ytd.current)}</b>{" "}
			pelo satélite de referência
			{ytd.ratio !== null && (
				<>
					, <b>{versusAverage(ytd.ratio)}</b> do mesmo período desde{" "}
					{ytd.years[0]?.year} ({NUMBER.format(Math.round(ytd.average))})
				</>
			)}
			{ytd.record && ytd.record.count > 0 && (
				<>
					. Recorde para o período: {focos(ytd.record.count)} em{" "}
					{ytd.record.year}
				</>
			)}
			.
		</Text>
	);
}

/**
 * A region's history: this year so far against the same period of every
 * year since 2003, the fire-season calendar and every year and the last 24
 * months from INPE's reference satellite (comparable across years), and
 * the last 90 days from all satellites. The current year, month and day are
 * partial.
 */
export function HistorySection({
	history,
	name,
}: {
	history: RegionHistory;
	name: string;
}) {
	const { years, months, days, ytd } = history;
	return (
		<Stack gap="md">
			<Stack gap={4}>
				<Title order={2} size="h4">
					Histórico
				</Title>
				<YtdSentence ytd={ytd} name={name} />
			</Stack>
			<BarSeries
				title={`De ${ytdPeriod(ytd.through)}, ano a ano`}
				bars={ytd.years.map((y) => ({
					key: String(y.year),
					label: String(y.year),
					value: y.count,
				}))}
			/>
			<FireCalendar calendar={history.calendar} through={ytd.through} />
			<BarSeries
				title="Ano inteiro (satélite de referência)"
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
				satélites mudou com o tempo. A comparação com anos anteriores vai até
				ontem, o último dia fechado, no mesmo dia do ano. Os dias contam todos
				os satélites, como o mapa
				{history.daysSince &&
					` (com registros desde ${DATE.format(Date.parse(`${history.daysSince}T00:00:00Z`))})`}
				. Datas no horário de Brasília; atualizado diariamente.
			</Text>
		</Stack>
	);
}
