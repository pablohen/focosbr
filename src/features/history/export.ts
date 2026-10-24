/**
 * The history section's downloads: each series as a CSV table. Pure, so the
 * shapes can be tested; the section turns them into files.
 */
import { csvTable } from "../fires/export";
import { slugify } from "../places/places";
import type { RegionHistory } from "./schemas";

export const HISTORY_TABLES = [
	{ id: "anos", label: "Por ano (satélite de referência)" },
	{ id: "meses", label: "Por mês desde 2003 (satélite de referência)" },
	{ id: "mesmo-periodo", label: "Mesmo período, ano a ano" },
	{ id: "temporada", label: "Temporada: acumulado no ano" },
	{ id: "dias", label: "Últimos 90 dias (todos os satélites)" },
] as const;
export type HistoryTable = (typeof HISTORY_TABLES)[number]["id"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "MM-DD" of a day of the year, on a non-leap year. */
const monthDay = (day: number) =>
	new Date(Date.UTC(2025, 0, day)).toISOString().slice(5, 10);

/** One history series as CSV. "parcial" is 1 for a period still counting. */
export function historyCsv(table: HistoryTable, h: RegionHistory): string {
	switch (table) {
		case "anos":
			return csvTable(
				["ano", "focos_satelite_referencia", "parcial"],
				h.years.map((y) => [y.key, y.count, y.partial ? 1 : 0]),
			);
		case "meses": {
			const last = h.ytd.through.slice(0, 7);
			return csvTable(
				["mes", "focos_satelite_referencia", "parcial"],
				h.calendar.flatMap((r) =>
					r.months.flatMap((count, m) => {
						const key = `${r.year}-${pad(m + 1)}`;
						// Months after yesterday's haven't started.
						if (key > last) return [];
						return [[key, count, key === last ? 1 : 0]];
					}),
				),
			);
		}
		case "mesmo-periodo":
			return csvTable(
				["ano", "de", "ate", "focos_satelite_referencia"],
				h.ytd.years.map((y) => [
					y.year,
					`${y.year}-01-01`,
					`${y.year}-${h.ytd.through.slice(5)}`,
					y.count,
				]),
			);
		case "temporada": {
			const s = h.season;
			const current = new Map(s.current.points.map((p) => [p.day, p.count]));
			const header = [
				"dia_do_ano",
				"ate",
				`acumulado_${s.current.year}`,
				"media",
				"minimo",
				"maximo",
			];
			if (s.record) header.push(`recorde_${s.record.year}`);
			return csvTable(
				header,
				s.days.map((day, k) => {
					const row: (string | number | null)[] = [
						day,
						monthDay(day),
						current.get(day) ?? null,
						s.average[k] ?? 0,
						s.min[k] ?? 0,
						s.max[k] ?? 0,
					];
					if (s.record) row.push(s.record.values[k] ?? 0);
					return row;
				}),
			);
		}
		case "dias":
			return csvTable(
				["data", "focos_todos_satelites", "parcial"],
				h.days.map((d) => [d.key, d.count, d.partial ? 1 : 0]),
			);
	}
}

/** "historico-para-anos-2026-10-23.csv". */
export function historyFileName(
	region: string,
	table: HistoryTable,
	through: string,
) {
	return `historico-${slugify(region)}-${table}-${through}.csv`;
}
