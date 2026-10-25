/**
 * The site's date formats, one per use, never numeric day/month ("23/10"
 * reads as the 23rd of October here but not everywhere):
 * - sentences: "23 de outubro de 2026" (`longDate`), "23 de outubro" (`longDayMonth`)
 * - labels and tables: "23 de out. de 2026" (`shortDate`), "23 de out." (`shortDayMonth`)
 * - moments, in Brasília: "23 de out., 14:05" (`shortMoment`), "14:05" (`clock`)
 * Calendar days ("2026-10-23") are formatted as UTC so they never shift.
 */
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const UTC = { timeZone: "UTC" } as const;
const BRT = { timeZone: "America/Sao_Paulo" } as const;

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
	...UTC,
	day: "numeric",
	month: "long",
	year: "numeric",
});
const LONG_DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
	...UTC,
	day: "numeric",
	month: "long",
});
const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", {
	...UTC,
	day: "numeric",
	month: "short",
	year: "numeric",
});
const SHORT_DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
	...UTC,
	day: "numeric",
	month: "short",
});
const MOMENT_DAY = new Intl.DateTimeFormat("pt-BR", {
	...BRT,
	day: "numeric",
	month: "short",
});
const CLOCK = new Intl.DateTimeFormat("pt-BR", { ...BRT, timeStyle: "short" });

export const longDate = (iso: string) => LONG_DATE.format(day(iso));
export const longDayMonth = (iso: string) => LONG_DAY_MONTH.format(day(iso));
export const shortDate = (iso: string) => SHORT_DATE.format(day(iso));
export const shortDayMonth = (iso: string) => SHORT_DAY_MONTH.format(day(iso));
/** A moment's time in Brasília, "14:05". */
export const clock = (d: Date | number) => CLOCK.format(d);
/** A moment's day in Brasília, "23 de out.". */
export const momentDay = (d: Date | number) => MOMENT_DAY.format(d);
/** A moment in Brasília, "23 de out., 14:05". */
export const shortMoment = (d: Date | number) => `${momentDay(d)}, ${clock(d)}`;
