/**
 * Point-in-state lookup over IBGE's state outlines, for detections that
 * arrive without a state (INPE's 10-minute files). Pure, so it can be
 * tested with small fixtures.
 */
import type {
	FeatureCollection,
	MultiPolygon,
	Polygon,
	Position,
} from "geojson";
import { type Bounds, boundsOf, inPolygon, polygonsOf } from "~/lib/geometry";

type State = { uf: string; bounds: Bounds; polygons: Position[][][] };

/**
 * Returns a function from `[lon, lat]` to the state code it falls in, or
 * null outside Brazil. Features need a `uf` property.
 */
export function createStateLocator(
	outlines: FeatureCollection<Polygon | MultiPolygon, { uf: string }>,
): (lon: number, lat: number) => string | null {
	const states: State[] = outlines.features.map((f) => {
		const polygons = polygonsOf(f.geometry);
		return { uf: f.properties.uf, bounds: boundsOf(polygons), polygons };
	});
	return (lon, lat) => {
		for (const { uf, bounds, polygons } of states) {
			const [w, s, e, n] = bounds;
			if (lon < w || lon > e || lat < s || lat > n) continue;
			if (polygons.some((p) => inPolygon(lon, lat, p))) return uf;
		}
		return null;
	};
}
