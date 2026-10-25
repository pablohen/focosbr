/**
 * Builds src/features/places/centroids.json: every municipality's centroid
 * (`[longitude, latitude]`, 3 decimals) by IBGE code, from IBGE's
 * municipal mesh (minimum quality). State pages place their city circles
 * with it. Re-run with pnpm geo:municipalities when IBGE changes the list.
 * Usage: pnpm geo:centroids
 */
import { writeFileSync } from "node:fs";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { centroidOf, polygonsOf } from "../src/lib/geometry";

const URL =
	"https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio";
const OUT = "src/features/places/centroids.json";

const res = await fetch(URL);
if (!res.ok) throw new Error(`${res.status} ${URL}`);
const mesh = (await res.json()) as FeatureCollection<
	Polygon | MultiPolygon,
	{ codarea: string }
>;
const round = (v: number) => Math.round(v * 1000) / 1000;
const centroids = Object.fromEntries(
	mesh.features
		.map((f) => {
			const [lon, lat] = centroidOf(polygonsOf(f.geometry));
			return [f.properties.codarea, [round(lon), round(lat)]] as const;
		})
		.sort((a, b) => a[0].localeCompare(b[0])),
);
writeFileSync(OUT, `${JSON.stringify(centroids)}\n`);
console.log(`${Object.keys(centroids).length} centroids → ${OUT}`);
