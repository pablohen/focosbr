/**
 * Builds, from IBGE's municipal mesh (minimum quality):
 * - src/features/places/centroids.json: every municipality's centroid
 *   (`[longitude, latitude]`, 3 decimals) by IBGE code, for the state
 *   pages' city circles;
 * - data/municipal-mesh.json.gz: the mesh itself, coordinates rounded to
 *   3 decimals (~100 m, finer than the forecast's 1 km grid), which
 *   scripts/forecast.ts samples. It's committed because IBGE's server
 *   doesn't answer GitHub's runners, where the forecast runs daily.
 * Re-run with pnpm geo:municipalities when IBGE changes the list.
 * Usage: pnpm geo:centroids
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { centroidOf, polygonsOf } from "../src/lib/geometry";

const URL =
	"https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio";
const OUT = "src/features/places/centroids.json";
const MESH_OUT = "data/municipal-mesh.json.gz";

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

// The mesh for the forecast: only the IBGE code, coordinates rounded.
const roundRing = (ring: number[][]) =>
	ring.map(([x = 0, y = 0]) => [round(x), round(y)]);
const slim = {
	type: "FeatureCollection",
	features: mesh.features.map((f) => ({
		type: "Feature",
		properties: { codarea: f.properties.codarea },
		geometry:
			f.geometry.type === "Polygon"
				? {
						type: "Polygon",
						coordinates: f.geometry.coordinates.map(roundRing),
					}
				: {
						type: "MultiPolygon",
						coordinates: f.geometry.coordinates.map((p) => p.map(roundRing)),
					},
	})),
};
mkdirSync("data", { recursive: true });
writeFileSync(MESH_OUT, gzipSync(JSON.stringify(slim), { level: 9 }));
console.log(`${mesh.features.length} municipalities → ${MESH_OUT}`);
