/**
 * Small planar geometry over GeoJSON coordinates (`[longitude, latitude]`),
 * for point-in-polygon lookups, centroids and sampling grids. Pure.
 */
import type { MultiPolygon, Polygon, Position } from "geojson";

/** [west, south, east, north]. */
export type Bounds = [number, number, number, number];

/** A Polygon's or MultiPolygon's polygons, as a list. */
export const polygonsOf = (g: Polygon | MultiPolygon): Position[][][] =>
	g.type === "Polygon" ? [g.coordinates] : g.coordinates;

/** The outer rings' bounds. */
export function boundsOf(polygons: Position[][][]): Bounds {
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
export function inRing(x: number, y: number, ring: Position[]): boolean {
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
export function inPolygon(
	x: number,
	y: number,
	polygon: Position[][],
): boolean {
	const [outer, ...holes] = polygon;
	return !!outer && inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h));
}

export const inPolygons = (x: number, y: number, polygons: Position[][][]) =>
	polygons.some((p) => inPolygon(x, y, p));

/**
 * The area-weighted centroid of the outer rings (holes ignored), in
 * degrees. For a concave shape it can fall outside; good enough to place a
 * symbol.
 */
export function centroidOf(polygons: Position[][][]): [number, number] {
	let a = 0;
	let cx = 0;
	let cy = 0;
	for (const polygon of polygons) {
		const ring = polygon[0] ?? [];
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi = 0, yi = 0] = ring[i] ?? [];
			const [xj = 0, yj = 0] = ring[j] ?? [];
			const cross = xj * yi - xi * yj;
			a += cross;
			cx += (xj + xi) * cross;
			cy += (yj + yi) * cross;
		}
	}
	if (a === 0) {
		const [w, s, e, n] = boundsOf(polygons);
		return [(w + e) / 2, (s + n) / 2];
	}
	return [cx / (3 * a), cy / (3 * a)];
}

/**
 * Points on a regular grid inside the polygons, about `max` of them at
 * most (the step grows with the area), and at least the centroid when the
 * shape is smaller than one step. For sampling rasters by region.
 */
export function gridPoints(
	polygons: Position[][][],
	max: number,
	minStep = 0,
): [number, number][] {
	const [w, s, e, n] = boundsOf(polygons);
	const step = Math.max(minStep, Math.sqrt(((e - w) * (n - s)) / max));
	const points: [number, number][] = [];
	if (step > 0)
		for (let y = s + step / 2; y < n; y += step)
			for (let x = w + step / 2; x < e; x += step)
				if (inPolygons(x, y, polygons)) points.push([x, y]);
	return points.length ? points : [centroidOf(polygons)];
}
