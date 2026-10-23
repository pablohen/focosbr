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

type Bounds = [number, number, number, number];
type State = { uf: string; bounds: Bounds; polygons: Position[][][] };

function boundsOf(polygons: Position[][][]): Bounds {
	let [w, s, e, n] = [180, 90, -180, -90];
	for (const polygon of polygons)
		for (const [x = 0, y = 0] of polygon[0] ?? []) {
			w = Math.min(w, x);
			e = Math.max(e, x);
			s = Math.min(s, y);
			n = Math.max(n, y);
		}
	return [w, s, e, n];
}

/** Even-odd ray casting; works for open or closed rings. */
function inRing(x: number, y: number, ring: Position[]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi = 0, yi = 0] = ring[i] ?? [];
		const [xj = 0, yj = 0] = ring[j] ?? [];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

/** Inside the outer ring and outside every hole. */
function inPolygon(x: number, y: number, polygon: Position[][]): boolean {
	const [outer, ...holes] = polygon;
	return !!outer && inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h));
}

/**
 * Returns a function from `[lon, lat]` to the state code it falls in, or
 * null outside Brazil. Features need a `uf` property.
 */
export function createStateLocator(
	outlines: FeatureCollection<Polygon | MultiPolygon, { uf: string }>,
): (lon: number, lat: number) => string | null {
	const states: State[] = outlines.features.map((f) => {
		const polygons =
			f.geometry.type === "Polygon"
				? [f.geometry.coordinates]
				: f.geometry.coordinates;
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
