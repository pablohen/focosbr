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
} from "../view";

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

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const COORD = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 4,
	maximumFractionDigits: 4,
});
const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

const DAY = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "America/Sao_Paulo",
});

/** "14:41 a 14:43", or with dates when the span crosses midnight in Brasília. */
function span(first: Date, last: Date): string {
	const sameDay = DAY.format(first) === DAY.format(last);
	const at = (d: Date) =>
		sameDay ? CLOCK.format(d) : `${DAY.format(d)} ${CLOCK.format(d)}`;
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
	row("Quando", `${TIME.format(fire.time)} (Brasília)`);
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

/** The region the map should show; `key` changes when the selection does. */
export type MapFocus = { key: string; bounds: BBox | null; uf?: string };

type Props = {
	data: FiresResponse | undefined;
	features: FeatureCollection<Point, FireProps>;
	focus: MapFocus;
	/** The shown detections grouped into fires, for the popup. */
	groups: FireGroups | undefined;
};

/** Hotspot map. Browser-only: load it through React.lazy behind <ClientOnly>. */
export default function FireMap({ data, features, focus, groups }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const [ready, setReady] = useState(false);
	// The selection the map last fitted to; "" is the whole country.
	const fittedKey = useRef("");
	// The latest props, for handlers registered once.
	const latest = useRef({ data, features, groups });
	latest.current = { data, features, groups };

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
			// Bring the dot to the bottom of the visible part of the map (beside
			// the panel, or above the phone sheet) so the popup fits above it.
			const container = map.getContainer();
			const padding = panelPadding(container);
			const visible = container.clientHeight - padding.top - padding.bottom;
			map.easeTo({
				center: e.lngLat,
				padding,
				offset: [0, Math.max(0, visible / 2 - 24)],
				duration: 300,
			});
			new Popup({ maxWidth: "300px", anchor: "bottom" })
				.setLngLat(e.lngLat)
				.setDOMContent(
					popupContent(current, latest.current.groups, i, Date.now()),
				)
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
