import type { FeatureCollection, Point } from "geojson";
import {
	type GeoJSONSource,
	Map as MapLibreMap,
	NavigationControl,
	Popup,
	ScaleControl,
	setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef } from "react";
import { autoHideAttribution } from "~/lib/map-attribution";
import type { FiresResponse } from "../schemas";
import { AGE_BANDS, describeFire, type FireProps } from "../view";

// MapLibre resolves its worker relative to its own module URL, which breaks
// once Vite rebundles it; point it at the published worker instead.
setWorkerUrl(workerUrl);

/** OpenFreeMap's style; free and keyless. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const BRAZIL: [number, number, number, number] = [-74, -34, -34.5, 5.5];
const SOURCE = "fires";

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

type Props = {
	data: FiresResponse | undefined;
	features: FeatureCollection<Point, FireProps>;
};

/** Hotspot map. Browser-only: load it through React.lazy behind <ClientOnly>. */
export default function FireMap({ data, features }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const readyRef = useRef(false);
	// The latest props, for handlers registered once.
	const latest = useRef({ data, features });
	latest.current = { data, features };

	useEffect(() => {
		if (!containerRef.current) return;
		const map = new MapLibreMap({
			container: containerRef.current,
			style: STYLE_URL,
			bounds: BRAZIL,
			// The panel covers the left 356 px on desktop and the bottom 45% on
			// phones; keep Brazil in the part left over.
			fitBoundsOptions: {
				padding:
					containerRef.current.clientWidth >= 768
						? { left: 356, top: 16, right: 16, bottom: 16 }
						: {
								left: 8,
								top: 8,
								right: 8,
								bottom: containerRef.current.clientHeight * 0.45 + 8,
							},
			},
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
			map.addSource(SOURCE, { type: "geojson", data: latest.current.features });
			map.addLayer({
				id: SOURCE,
				type: "circle",
				source: SOURCE,
				paint: {
					"circle-color": [
						"step",
						["get", "age"],
						AGE_BANDS[0].color,
						AGE_BANDS[0].maxHours,
						AGE_BANDS[1].color,
						AGE_BANDS[1].maxHours,
						AGE_BANDS[2].color,
					],
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
			readyRef.current = true;
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
		map.on("mouseenter", SOURCE, () => {
			map.getCanvas().style.cursor = "pointer";
		});
		map.on("mouseleave", SOURCE, () => {
			map.getCanvas().style.cursor = "";
		});

		return () => {
			cancelAutoHide();
			readyRef.current = false;
			mapRef.current = null;
			map.remove();
		};
	}, []);

	useEffect(() => {
		if (!readyRef.current) return;
		mapRef.current?.getSource<GeoJSONSource>(SOURCE)?.setData(features);
	}, [features]);

	return (
		<section
			ref={containerRef}
			style={{ position: "absolute", inset: 0 }}
			aria-label="Mapa de focos de calor"
		/>
	);
}
