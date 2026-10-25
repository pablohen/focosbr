const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});

/** "1º de janeiro a 23 de outubro" for a year-to-date `through` day. */
export function ytdPeriod(through: string) {
	return `1º de janeiro a ${DAY_MONTH.format(Date.parse(`${through}T00:00:00Z`))}`;
}

/** "29% abaixo da média", "12% acima da média" or "na média", from a ratio to the average. */
export function versusAverage(ratio: number) {
	const pct = Math.round((ratio - 1) * 100);
	if (pct === 0) return "na média";
	return `${Math.abs(pct)}% ${pct > 0 ? "acima" : "abaixo"} da média`;
}

/** "+12%", "−29%" or "0%" against the average, for tables. */
export function percentVsAverage(ratio: number) {
	const pct = Math.round((ratio - 1) * 100);
	return pct > 0 ? `+${pct}%` : pct < 0 ? `−${-pct}%` : "0%";
}

const DAY = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	timeZone: "UTC",
});
const parseDay = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** "18 a 24 de outubro de 2026", or "28 de setembro a 4 de outubro de 2026". */
export function weekLabel(from: string, through: string) {
	const sameMonth = from.slice(0, 7) === through.slice(0, 7);
	const start = sameMonth
		? DAY.format(parseDay(from))
		: DAY_MONTH.format(parseDay(from));
	return `${start} a ${DAY_MONTH.format(parseDay(through))} de ${through.slice(0, 4)}`;
}

const NUMBER = new Intl.NumberFormat("pt-BR");

/**
 * A year page's headline. A complete year is ranked among complete years
 * and set against their average; the current year says it's still counting.
 */
export function yearSentence(
	s: {
		year: number;
		partial: boolean;
		through: string;
		totals: { year: number; count: number }[];
	},
	firstYear: number,
) {
	const total = s.totals.find((t) => t.year === s.year)?.count ?? 0;
	const complete = s.totals.filter(
		(t) => t.year < Number(s.through.slice(0, 4)),
	);
	const average = complete.length
		? Math.round(complete.reduce((a, t) => a + t.count, 0) / complete.length)
		: 0;
	if (s.partial)
		return `Em ${s.year}, de ${ytdPeriod(s.through)}: ${NUMBER.format(total)} focos pelo satélite de referência do INPE (ano em curso). A média de um ano inteiro desde ${firstYear} é de ${NUMBER.format(average)}.`;
	const rank =
		[...complete]
			.sort((a, b) => b.count - a.count)
			.findIndex((t) => t.year === s.year) + 1;
	return `Em ${s.year}, ${NUMBER.format(total)} focos pelo satélite de referência do INPE: o ${rank}º ano com mais focos entre os ${complete.length} desde ${firstYear} (média de ${NUMBER.format(average)} por ano).`;
}
