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
import { autoHideAttribution } from "~/lib/map-attribution";
import type { FiresResponse } from "../schemas";
import { AGE_BANDS, describeFire, type FireProps } from "../view";

// MapLibre resolves its worker relative to its own module URL, which breaks
// once Vite rebundles it; point it at the published worker instead.
setWorkerUrl(workerUrl);

/** OpenFreeMap's style; free and keyless. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
type BBox = [number, number, number, number];

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

const TIME = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

/** Popup body built from text nodes: names come from INPE, not from us. */
function popupContent(data: FiresResponse, i: number): HTMLElement {
	const fire = describeFire(data, i);
	const root = document.createElement("div");
	root.style.font = "13px/1.45 var(--mantine-font-family)";
	const line = (text: string, bold = false) => {
		const el = document.createElement("div");
		el.textContent = text;
		if (bold) el.style.fontWeight = "600";
		root.append(el);
	};
	line(fire.place, true);
	if (fire.biome) line(fire.biome);
	line(`${TIME.format(fire.time)} (horário de Brasília)`);
	line(`Satélite ${fire.satellite}`);
	if (fire.frp !== null) line(`Potência radiativa ${fire.frp} MW`);
	return root;
}

/** The region the map should show; `key` changes when the selection does. */
export type MapFocus = { key: string; bounds: BBox | null; uf?: string };

type Props = {
	data: FiresResponse | undefined;
	features: FeatureCollection<Point, FireProps>;
	focus: MapFocus;
};

/** Hotspot map. Browser-only: load it through React.lazy behind <ClientOnly>. */
export default function FireMap({ data, features, focus }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const [ready, setReady] = useState(false);
	// The selection the map last fitted to; "" is the whole country.
	const fittedKey = useRef("");
	// The latest props, for handlers registered once.
	const latest = useRef({ data, features });
	latest.current = { data, features };

	useEffect(() => {
		if (!containerRef.current) return;
		const map = new MapLibreMap({
			container: containerRef.current,
			style: STYLE_URL,
			bounds: BRAZIL,
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
			const i = Number(feature.properties?.i);
			new Popup({ maxWidth: "260px" })
				.setLngLat(e.lngLat)
				.setDOMContent(popupContent(current, i))
				.addTo(map);
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

	// Fit once per selection, when its detections are in: a refresh or a
	// sensor change must not yank the map away from where the user panned.
	useEffect(() => {
		const map = mapRef.current;
		if (!ready || !map || focus.key === fittedKey.current) return;
		const target = focus.key ? focus.bounds : BRAZIL;
		if (!target) return;
		fittedKey.current = focus.key;
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
