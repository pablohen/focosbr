import type { FeatureCollection, Point } from "geojson";
import {
	type ExpressionSpecification,
	type GeoJSONSource,
	Map as MapLibreMap,
	NavigationControl,
	Popup,
	ScaleControl,
	setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import { clock, momentDay, shortMoment } from "~/lib/dates";
import { autoHideAttribution } from "~/lib/map-attribution";
import type { BBox, FiresResponse } from "../schemas";
import {
	AGE_BANDS,
	describeFire,
	describeGroup,
	type FireGroups,
	type FireProps,
	formatAgo,
	riskClass,
	SENSOR_LABELS,
	SENSOR_RESOLUTION,
	type TopFire,
} from "../view";

// MapLibre resolves its worker relative to its own module URL, which breaks
// once Vite rebundles it; point it at the published worker instead.
setWorkerUrl(workerUrl);

/** OpenFreeMap's style; free and keyless. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const BRAZIL: BBox = [-74, -34, -34.5, 5.5];
const SOURCE = "fires";
const CLUSTERS = "fire-clusters";
const CLUSTER_COUNT = "fire-cluster-count";
/** Above this zoom every detection is its own dot. */
const CLUSTER_MAX_ZOOM = 6;
const STATES = "states";
const STATE_OUTLINE = "state-outline";

/** Age-band colour for an age in hours (a detection's, or a cluster's newest). */
function ageColor(age: ExpressionSpecification): ExpressionSpecification {
	return [
		"step",
		age,
		AGE_BANDS[0].color,
		AGE_BANDS[0].maxHours,
		AGE_BANDS[1].color,
		AGE_BANDS[1].maxHours,
		AGE_BANDS[2].color,
	];
}

/**
 * The panel covers the left 356 px on desktop and the bottom 45% of the
 * window (45dvh) on phones;
 * fits keep their target in the part left over.
 */
function panelPadding(container: HTMLElement) {
	return container.clientWidth >= 768
		? { left: 356, top: 16, right: 16, bottom: 16 }
		: { left: 8, top: 8, right: 8, bottom: window.innerHeight * 0.45 + 8 };
}

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const COORD = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 4,
	maximumFractionDigits: 4,
});
/** "14:41 a 14:43", or with dates when the span crosses midnight in Brasília. */
function span(first: Date, last: Date): string {
	const sameDay = momentDay(first) === momentDay(last);
	const at = (d: Date) => (sameDay ? clock(d) : shortMoment(d));
	return `${at(first)} a ${at(last)}`;
}

/**
 * Popup body, built from DOM nodes and text: names come from INPE, so no
 * HTML strings. Rows only appear when INPE has the value.
 */
function popupContent(
	data: FiresResponse,
	groups: FireGroups | undefined,
	i: number,
	nowMs: number,
): HTMLElement {
	const fire = describeFire(data, i);
	const el = <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		text: string,
		style: Partial<CSSStyleDeclaration> = {},
	) => {
		const node = document.createElement(tag);
		node.textContent = text;
		Object.assign(node.style, style);
		return node;
	};
	const dimmed = { color: "var(--mantine-color-dimmed)" };

	const root = document.createElement("div");
	root.style.font = "13px/1.45 var(--mantine-font-family)";
	root.append(el("div", fire.place, { fontWeight: "700", fontSize: "14px" }));
	const ago = formatAgo(Math.floor((nowMs - fire.time.getTime()) / 60_000));
	root.append(
		el(
			"div",
			[fire.biome, `detectado ${ago}`].filter(Boolean).join(" · "),
			dimmed,
		),
	);

	const rows = document.createElement("dl");
	Object.assign(rows.style, {
		display: "grid",
		gridTemplateColumns: "auto 1fr",
		gap: "2px 10px",
		margin: "8px 0",
	});
	const row = (label: string, value: string) =>
		rows.append(el("dt", label, dimmed), el("dd", value, { margin: "0" }));
	row("Quando", `${shortMoment(fire.time)} (Brasília)`);
	const resolution = SENSOR_RESOLUTION[fire.sensor];
	row(
		"Satélite",
		[fire.satellite, SENSOR_LABELS[fire.sensor], resolution]
			.filter(Boolean)
			.join(" · "),
	);
	if (fire.frp !== null) row("Potência", `${NUMBER.format(fire.frp)} MW`);
	if (fire.dryDays !== null)
		row(
			"Sem chuva",
			fire.dryDays === 1 ? "1 dia" : `${NUMBER.format(fire.dryDays)} dias`,
		);
	if (fire.rain !== null) row("Precipitação", `${NUMBER.format(fire.rain)} mm`);
	if (fire.risk !== null)
		row(
			"Risco de fogo",
			`${riskClass(fire.risk)} (${NUMBER.format(fire.risk * 100)}%)`,
		);
	root.append(rows);

	if (groups) {
		const group = describeGroup(data, groups, i);
		if (group.count > 1)
			root.append(
				el(
					"div",
					`Mesmo fogo: ${group.count} detecções de ${span(group.first, group.last)}, por ${group.satellites.join(", ")}.`,
				),
			);
	}
	if (fire.preliminary)
		root.append(
			el(
				"div",
				"Preliminar: município, bioma e clima chegam na próxima atualização do INPE.",
				dimmed,
			),
		);
	else if (fire.risk === null)
		root.append(
			el(
				"div",
				"Clima (dias sem chuva, risco de fogo) chega quando o INPE fecha o dia.",
				dimmed,
			),
		);

	const where = document.createElement("div");
	where.style.marginTop = "6px";
	const coords = `${COORD.format(fire.lat)}, ${COORD.format(fire.lon)}`;
	where.append(el("span", `${coords} · `, dimmed));
	const link = el("a", "ver no OpenStreetMap");
	Object.assign(link, {
		href: `https://www.openstreetmap.org/?mlat=${fire.lat}&mlon=${fire.lon}#map=14/${fire.lat}/${fire.lon}`,
		target: "_blank",
		rel: "noreferrer",
	});
	link.style.color = "var(--mantine-color-anchor)";
	where.append(link);
	root.append(where);
	return root;
}

/**
 * Eases detection `i` to the bottom of the visible part of the map (beside
 * the panel, or above the phone sheet) and opens its popup above it,
 * replacing the one in `popup`.
 */
function showDetection(
	map: MapLibreMap,
	data: FiresResponse,
	groups: FireGroups | undefined,
	i: number,
	popup: { current: Popup | null },
	zoom?: number,
) {
	const at: [number, number] = [data.fires.lon[i] ?? 0, data.fires.lat[i] ?? 0];
	const container = map.getContainer();
	const padding = panelPadding(container);
	const visible = container.clientHeight - padding.top - padding.bottom;
	map.easeTo({
		center: at,
		zoom,
		padding,
		offset: [0, Math.max(0, visible / 2 - 24)],
		duration: zoom === undefined ? 300 : 800,
	});
	popup.current?.remove();
	popup.current = new Popup({ maxWidth: "300px", anchor: "bottom" })
		.setLngLat(at)
		.setDOMContent(popupContent(data, groups, i, Date.now()))
		.addTo(map);
}

/** A fire picked from the list; `nonce` changes on every pick, even a repeat. */
export type FireTarget = { nonce: number; fire: TopFire };

/** The region the map should show; `key` changes when the selection does. */
export type MapFocus = { key: string; bounds: BBox | null; uf?: string };

type Props = {
	data: FiresResponse | undefined;
	features: FeatureCollection<Point, FireProps>;
	focus: MapFocus;
	/** The shown detections grouped into fires, for the popup. */
	groups: FireGroups | undefined;
	target: FireTarget | null;
	/** Where to open the map (from the URL); read once, on mount. */
	initialBBox: BBox | undefined;
	/** The visible area after each move the user made (or asked for). */
	onViewportChange: (bbox: BBox) => void;
};

/** Hotspot map. Browser-only: load it through React.lazy behind <ClientOnly>. */
export default function FireMap({
	data,
	features,
	focus,
	groups,
	target,
	initialBBox,
	onViewportChange,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const [ready, setReady] = useState(false);
	const popupRef = useRef<Popup | null>(null);
	// The selection the map last fitted to; "" is the whole country. A map
	// opened at a URL position keeps it instead of fitting the selection.
	const fittedKey = useRef(initialBBox ? focus.key : "");
	// Read once: later URL updates come from the map itself.
	const openAt = useRef(initialBBox);
	// The selection in the URL at load: fitting to it isn't a user move.
	const loadedKey = useRef(focus.key);
	// Set before a move the user asked for without touching the map (a
	// cluster, a dot, a list row, a new selection), so it reaches the URL.
	const userMove = useRef(false);
	// The latest props, for handlers registered once.
	const latest = useRef({ data, features, groups, onViewportChange });
	latest.current = { data, features, groups, onViewportChange };

	useEffect(() => {
		if (!containerRef.current) return;
		const map = new MapLibreMap({
			container: containerRef.current,
			style: STYLE_URL,
			bounds: openAt.current ?? BRAZIL,
			fitBoundsOptions: { padding: panelPadding(containerRef.current) },
			attributionControl: {
				compact: true,
				customAttribution:
					'Focos: <a href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/" target="_blank" rel="noreferrer">INPE Programa Queimadas</a>',
			},
			locale: {
				"NavigationControl.ZoomIn": "Aproximar",
				"NavigationControl.ZoomOut": "Afastar",
				"NavigationControl.ResetBearing": "Apontar para o norte",
			},
		});
		mapRef.current = map;
		map.addControl(new NavigationControl({ showCompass: false }), "top-right");
		map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

		// Report the visible area (not the part under the panel) after moves
		// the user made: drags, zooms, controls (they carry an originalEvent)
		// or clicks that moved the map. The fit on load isn't one of them, so
		// a plain visit doesn't write a position into the URL.
		map.on("moveend", (e) => {
			if (!e.originalEvent && !userMove.current) return;
			userMove.current = false;
			const c = map.getContainer();
			const pad = panelPadding(c);
			const nw = map.unproject([pad.left, pad.top]);
			const se = map.unproject([
				c.clientWidth - pad.right,
				c.clientHeight - pad.bottom,
			]);
			const round = (v: number) => Math.round(v * 1000) / 1000;
			latest.current.onViewportChange([
				round(Math.max(-180, nw.lng)),
				round(Math.max(-90, se.lat)),
				round(Math.min(180, se.lng)),
				round(Math.min(90, nw.lat)),
			]);
		});

		let cancelAutoHide = () => {};
		map.on("load", () => {
			cancelAutoHide = autoHideAttribution(map.getContainer());
			// The selected state's outline, under the fires (IBGE boundaries).
			map.addSource(STATES, {
				type: "geojson",
				data: "/data/state-outlines.geojson",
			});
			map.addLayer({
				id: STATE_OUTLINE,
				type: "line",
				source: STATES,
				filter: ["==", ["get", "uf"], ""],
				paint: { "line-color": "#3b3b3b", "line-width": 1.5 },
			});
			// At low zoom nearby detections merge into clusters, coloured by their
			// newest detection; 28k dots on one screen just overlap.
			map.addSource(SOURCE, {
				type: "geojson",
				data: latest.current.features,
				cluster: true,
				clusterMaxZoom: CLUSTER_MAX_ZOOM,
				clusterRadius: 40,
				clusterProperties: { newest: ["min", ["get", "age"]] },
			});
			map.addLayer({
				id: CLUSTERS,
				type: "circle",
				source: SOURCE,
				filter: ["has", "point_count"],
				paint: {
					"circle-color": ageColor(["get", "newest"]),
					"circle-radius": [
						"step",
						["get", "point_count"],
						12,
						50,
						16,
						250,
						21,
						1000,
						27,
					],
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 2,
					"circle-opacity": 0.92,
				},
			});
			map.addLayer({
				id: CLUSTER_COUNT,
				type: "symbol",
				source: SOURCE,
				filter: ["has", "point_count"],
				layout: {
					"text-field": [
						"number-format",
						["get", "point_count"],
						{ locale: "pt-BR" },
					],
					"text-font": ["Noto Sans Bold"],
					"text-size": 11,
					"text-allow-overlap": true,
				},
				paint: {
					// Dark text on the lightest band, white on the others.
					"text-color": [
						"step",
						["get", "newest"],
						"#ffffff",
						AGE_BANDS[1].maxHours,
						"#3b0a04",
					],
				},
			});
			map.addLayer({
				id: SOURCE,
				type: "circle",
				source: SOURCE,
				filter: ["!", ["has", "point_count"]],
				paint: {
					"circle-color": ageColor(["get", "age"]),
					// Bigger for stronger fires (FRP, MW) and as you zoom in.
					"circle-radius": [
						"interpolate",
						["linear"],
						["zoom"],
						3,
						["interpolate", ["linear"], ["get", "frp"], 0, 1.5, 200, 4],
						10,
						["interpolate", ["linear"], ["get", "frp"], 0, 6, 200, 16],
					],
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": [
						"interpolate",
						["linear"],
						["zoom"],
						3,
						0.5,
						8,
						1.5,
					],
					"circle-opacity": 0.92,
				},
				// Newest on top.
				layout: { "circle-sort-key": ["-", 0, ["get", "age"]] },
			});
			setReady(true);
		});

		map.on("click", SOURCE, (e) => {
			const feature = e.features?.[0];
			const current = latest.current.data;
			if (!feature || !current) return;
			userMove.current = true;
			showDetection(
				map,
				current,
				latest.current.groups,
				Number(feature.properties?.i),
				popupRef,
			);
		});
		// A cluster zooms in to where it splits.
		map.on("click", CLUSTERS, async (e) => {
			const feature = e.features?.[0];
			const id = feature?.properties?.cluster_id;
			if (!feature || id === undefined || feature.geometry.type !== "Point")
				return;
			const zoom = await map
				.getSource<GeoJSONSource>(SOURCE)
				?.getClusterExpansionZoom(id);
			userMove.current = true;
			map.easeTo({
				center: feature.geometry.coordinates as [number, number],
				zoom: zoom ?? map.getZoom() + 2,
				padding: panelPadding(map.getContainer()),
			});
		});
		for (const layer of [SOURCE, CLUSTERS]) {
			map.on("mouseenter", layer, () => {
				map.getCanvas().style.cursor = "pointer";
			});
			map.on("mouseleave", layer, () => {
				map.getCanvas().style.cursor = "";
			});
		}

		return () => {
			cancelAutoHide();
			setReady(false);
			mapRef.current = null;
			map.remove();
		};
	}, []);

	useEffect(() => {
		if (!ready) return;
		mapRef.current?.getSource<GeoJSONSource>(SOURCE)?.setData(features);
	}, [ready, features]);

	useEffect(() => {
		if (!ready) return;
		mapRef.current?.setFilter(STATE_OUTLINE, [
			"==",
			["get", "uf"],
			focus.uf ?? "",
		]);
	}, [ready, focus.uf]);

	// A fire picked from the list: zoom to its extent, at its newest detection.
	useEffect(() => {
		const map = mapRef.current;
		const current = latest.current.data;
		if (!ready || !map || !target || !current) return;
		userMove.current = true;
		const camera = map.cameraForBounds(target.fire.bounds, {
			padding: panelPadding(map.getContainer()),
			maxZoom: 12,
		});
		showDetection(
			map,
			current,
			latest.current.groups,
			target.fire.focus,
			popupRef,
			Math.max(camera?.zoom ?? 10, CLUSTER_MAX_ZOOM + 1),
		);
	}, [ready, target]);

	// Fit once per selection, when its detections are in: a refresh or a
	// sensor change must not yank the map away from where the user panned.
	useEffect(() => {
		const map = mapRef.current;
		if (!ready || !map || focus.key === fittedKey.current) return;
		const target = focus.key ? focus.bounds : BRAZIL;
		if (!target) return;
		fittedKey.current = focus.key;
		userMove.current = focus.key !== loadedKey.current;
		map.fitBounds(target, {
			padding: panelPadding(map.getContainer()),
			maxZoom: 9,
		});
	}, [ready, focus.key, focus.bounds]);

	return (
		<section
			ref={containerRef}
			style={{ position: "absolute", inset: 0 }}
			aria-label="Mapa de focos de calor"
		/>
	);
}
