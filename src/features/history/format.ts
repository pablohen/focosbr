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
