/**
 * The share card's mini map: Brazil's state outlines and the view's
 * hotspots as SVG, projected into a box. Pure, so it can be tested.
 */
import type {
	FeatureCollection,
	MultiPolygon,
	Polygon,
	Position,
} from "geojson";
import type { BBox, FiresResponse } from "../fires/schemas";
import { AGE_BANDS } from "../fires/view";

export type Outlines = FeatureCollection<
	Polygon | MultiPolygon,
	{ uf: string }
>;
type Project = (lon: number, lat: number) => [number, number];

export const BRAZIL: BBox = [-74, -34, -34.5, 5.5];

/**
 * Equirectangular projection of `bbox` into a `width`×`height` box, scaled
 * by the cosine of the middle latitude so shapes look right, and centred.
 */
export function projector(bbox: BBox, width: number, height: number): Project {
	const [w, s, e, n] = bbox;
	const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
	const scale = Math.min(width / ((e - w) * k), height / (n - s));
	const dx = (width - (e - w) * k * scale) / 2;
	const dy = (height - (n - s) * scale) / 2;
	return (lon, lat) => [dx + (lon - w) * k * scale, dy + (n - lat) * scale];
}

function polygonsOf(f: Outlines["features"][number]): Position[][][] {
	return f.geometry.type === "Polygon"
		? [f.geometry.coordinates]
		: f.geometry.coordinates;
}

/**
 * One SVG path for the given states' rings, dropping points closer than
 * `minStep` px to the last kept one: the full IBGE outlines would make a
 * several-hundred-KB path for a 500 px map.
 */
export function outlinePath(
	outlines: Outlines,
	project: Project,
	keep: (uf: string) => boolean = () => true,
	minStep = 1.5,
	/** Drops rings entirely outside this box (with a margin). */
	frame?: { width: number; height: number },
): string {
	const parts: string[] = [];
	for (const f of outlines.features) {
		if (!keep(f.properties.uf)) continue;
		for (const polygon of polygonsOf(f))
			for (const ring of polygon) {
				let last: [number, number] | null = null;
				const pts: string[] = [];
				for (const [lon = 0, lat = 0] of ring) {
					const [x, y] = project(lon, lat);
					if (last && Math.hypot(x - last[0], y - last[1]) < minStep) continue;
					pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
					last = [x, y];
				}
				if (pts.length < 3) continue;
				if (frame && !ringInFrame(ring, project, frame)) continue;
				parts.push(`M${pts.join("L")}Z`);
			}
	}
	return parts.join("");
}

function ringInFrame(
	ring: Position[],
	project: Project,
	{ width, height }: { width: number; height: number },
): boolean {
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [lon = 0, lat = 0] of ring) {
		const [x, y] = project(lon, lat);
		x0 = Math.min(x0, x);
		x1 = Math.max(x1, x);
		y0 = Math.min(y0, y);
		y1 = Math.max(y1, y);
	}
	const m = 20;
	return x1 >= -m && y1 >= -m && x0 <= width + m && y0 <= height + m;
}

/**
 * Many dots as one SVG path: a zero-length segment per point, drawn with a
 * round line cap and a stroke as wide as the dot. ~13 bytes a dot instead
 * of ~100 for a <circle>.
 */
export function dotsPath(points: [number, number][]): string {
	return points.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)}h0`).join("");
}

/** The state's bounds with a 6% margin, or Brazil's. */
export function cardBounds(outlines: Outlines, uf?: string): BBox {
	const state = uf && outlines.features.find((f) => f.properties.uf === uf);
	if (!state) return BRAZIL;
	let [w, s, e, n] = [180, 90, -180, -90];
	for (const polygon of polygonsOf(state))
		for (const [lon = 0, lat = 0] of polygon[0] ?? []) {
			w = Math.min(w, lon);
			e = Math.max(e, lon);
			s = Math.min(s, lat);
			n = Math.max(n, lat);
		}
	const mx = (e - w) * 0.06;
	const my = (n - s) * 0.06;
	return [w - mx, s - my, e + mx, n + my];
}

export type Dot = { x: number; y: number; color: string };

/**
 * The newest `max` detections as dots coloured by age band, inside the box
 * only. Oldest first, so the newest draw on top.
 */
export function cardDots(
	data: FiresResponse,
	indices: number[],
	project: Project,
	size: { width: number; height: number },
	nowMs: number,
	max = 4000,
): Dot[] {
	const dots: Dot[] = [];
	for (const i of indices.slice(-max)) {
		const [x, y] = project(data.fires.lon[i] ?? 0, data.fires.lat[i] ?? 0);
		if (x < 0 || y < 0 || x > size.width || y > size.height) continue;
		const age = (nowMs / 1000 - (data.fires.t[i] ?? 0)) / 3600;
		const band = AGE_BANDS.find((b) => age < b.maxHours) ?? AGE_BANDS[2];
		dots.push({ x, y, color: band.color });
	}
	return dots;
}
