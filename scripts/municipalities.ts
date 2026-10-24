/**
 * Builds src/features/places/municipalities.json: every Brazilian
 * municipality's IBGE code and official name, by state, from IBGE's
 * localidades API. The server labels INPE's detections with these names
 * (matched by `municipio_id`), and the city pages and sitemap come from it.
 * Re-run when IBGE creates or renames municipalities.
 * Usage: pnpm geo:municipalities
 */
import { writeFileSync } from "node:fs";

const URL =
	"https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado";
const OUT = "src/features/places/municipalities.json";

type Row = {
	"municipio-id": number;
	"municipio-nome": string;
	"UF-sigla": string;
};

const res = await fetch(URL);
if (!res.ok) throw new Error(`${res.status} ${URL}`);
const rows = (await res.json()) as Row[];

/** `{ "PA": [[1500602, "Altamira"], …], … }`, states and names sorted. */
const byState: Record<string, [number, string][]> = {};
for (const r of rows) {
	const list = byState[r["UF-sigla"]] ?? [];
	list.push([r["municipio-id"], r["municipio-nome"]]);
	byState[r["UF-sigla"]] = list;
}
const sorted = Object.fromEntries(
	Object.entries(byState)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([uf, list]) => [
			uf,
			list.sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
		]),
);

writeFileSync(OUT, `${JSON.stringify(sorted)}\n`);
console.log(`${rows.length} municipalities → ${OUT}`);
