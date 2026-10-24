/**
 * Alerts for the feed, from each region's stored series after the daily
 * history run. Pure, so the rules can be tested. Ids are deterministic, so
 * re-running a day inserts nothing new.
 */
import { z } from "zod";
import { RANKING_MIN_AVERAGE, type Ytd } from "./schemas";

/** The smallest record day worth an alert (a quiet place's "record" of 2 isn't news). */
export const MIN_RECORD_DAY = 10;
export const ALERTS_COLLECTION = "alerts";

export const AlertSchema = z.object({
	_id: z.string(),
	type: z.enum(["double", "record-day"]),
	/** The region's history `_id`. */
	regionId: z.string(),
	kind: z.enum(["country", "state", "city", "biome"]),
	name: z.string(),
	/** The region's page. */
	path: z.string(),
	/** The day the alert is about ("2026-10-23", Brasília). */
	date: z.string(),
	/** double: this year so far, its average and ratio; record-day: the day's count and the previous record. */
	current: z.number().int(),
	average: z.number().optional(),
	ratio: z.number().optional(),
	previous: z
		.object({ day: z.string(), count: z.number().int() })
		.nullable()
		.optional(),
	createdAt: z.date(),
});
export type Alert = z.infer<typeof AlertSchema>;
export type AlertDraft = Omit<Alert, "name" | "path" | "createdAt">;

/** A region's alerts for the last closed day, from its reference days and year to date. */
export function regionAlerts(
	region: { id: string; kind: Alert["kind"] },
	refDays: Record<string, number>,
	ytd: Ytd,
): AlertDraft[] {
	const alerts: AlertDraft[] = [];
	const year = ytd.through.slice(0, 4);
	if (
		region.kind !== "country" &&
		ytd.ratio !== null &&
		ytd.ratio >= 2 &&
		ytd.average >= RANKING_MIN_AVERAGE
	)
		alerts.push({
			_id: `double:${region.id}:${year}`,
			type: "double",
			regionId: region.id,
			kind: region.kind,
			date: ytd.through,
			current: ytd.current,
			average: ytd.average,
			ratio: ytd.ratio,
		});
	// Record days: big regions only; a city's daily counts are too small and noisy.
	if (region.kind !== "city") {
		const count = refDays[ytd.through] ?? 0;
		let previous: { day: string; count: number } | null = null;
		for (const [day, n] of Object.entries(refDays))
			if (day < ytd.through && n > (previous?.count ?? 0))
				previous = { day, count: n };
		if (count >= MIN_RECORD_DAY && previous && count > previous.count)
			alerts.push({
				_id: `record-day:${region.id}:${ytd.through}`,
				type: "record-day",
				regionId: region.id,
				kind: region.kind,
				date: ytd.through,
				current: count,
				previous,
			});
	}
	return alerts;
}

const NUMBER = new Intl.NumberFormat("pt-BR");
const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});
const longDate = (day: string) =>
	LONG_DATE.format(Date.parse(`${day}T00:00:00Z`));

/** An alert's headline and one-sentence summary, in Portuguese. */
export function alertText(
	a: Pick<
		Alert,
		"type" | "name" | "date" | "current" | "average" | "ratio" | "previous"
	>,
	firstYear: number,
): { title: string; summary: string } {
	if (a.type === "double") {
		const pct = Math.round(((a.ratio ?? 2) - 1) * 100);
		return {
			title: `${a.name} passa do dobro da média de focos no ano`,
			summary: `De 1º de janeiro a ${longDate(a.date)}: ${NUMBER.format(a.current)} focos pelo satélite de referência, ${pct}% acima da média do mesmo período desde ${firstYear} (${NUMBER.format(Math.round(a.average ?? 0))}).`,
		};
	}
	return {
		title: `${a.name} tem o dia com mais focos desde ${firstYear}`,
		summary: `${NUMBER.format(a.current)} focos em ${longDate(a.date)} pelo satélite de referência${a.previous ? `; o recorde anterior era de ${NUMBER.format(a.previous.count)}, em ${longDate(a.previous.day)}` : ""}.`,
	};
}

const escapeXml = (s: string) =>
	s.replace(
		/[<>&'"]/g,
		(c) =>
			({
				"<": "&lt;",
				">": "&gt;",
				"&": "&amp;",
				"'": "&apos;",
				'"': "&quot;",
			})[c] ?? c,
	);

/** RSS 2.0 for the alerts, newest first; links are absolute. */
export function alertsRss(
	alerts: Pick<
		Alert,
		| "_id"
		| "type"
		| "name"
		| "path"
		| "date"
		| "current"
		| "average"
		| "ratio"
		| "previous"
		| "createdAt"
	>[],
	site: string,
	firstYear: number,
): string {
	const items = alerts
		.map((a) => {
			const { title, summary } = alertText(a, firstYear);
			const link = new URL(a.path, site).href;
			return `<item><title>${escapeXml(title)}</title><link>${escapeXml(link)}</link><guid isPermaLink="false">${escapeXml(a._id)}</guid><pubDate>${a.createdAt.toUTCString()}</pubDate><description>${escapeXml(summary)}</description></item>`;
		})
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>FocosBR · Alertas</title><link>${escapeXml(new URL("/alerts", site).href)}</link><atom:link href="${escapeXml(new URL("/feed.xml", site).href)}" rel="self" type="application/rss+xml"/><description>Municípios, estados e biomas que passam do dobro da média de focos de calor no ano, e dias recordes, com dados do INPE.</description><language>pt-BR</language>${items}</channel></rss>`;
}
