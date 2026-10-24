/**
 * Share images (1200×630) for a view of the map: the fire estimate, the
 * detection count, this year against the average of past years (for one
 * region with every sensor) and a mini map. Satori lays the JSX out as SVG and resvg
 * (WebAssembly) turns it into PNG. The wasm and fonts are inlined as base64
 * into this module's chunk, which only `/og` loads (by dynamic import).
 *
 * Inter's Latin subset has no "≈", so the card says "cerca de" instead.
 */
import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff?base64";
import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff?base64";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?base64";
import satori from "satori";
import outlinesText from "../../../public/data/state-outlines.geojson?raw";
import { getFires } from "../fires/fires.server";
import { SENSOR_LABELS, selectFires, summarize } from "../fires/view";
import { versusAverage } from "../history/format";
import { loadYtd } from "../history/history.server";
import { biomeByName } from "../places/biomes";
import { slugify, splitPlaceLabel } from "../places/places";
import { municipalities } from "../places/places.server";
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	type CardView,
	CardViewSchema,
	cardHistoryId,
	regionLabel,
} from "./card";
import {
	cardBounds,
	cardDots,
	type Outlines,
	outlinePath,
	projector,
} from "./card-map";

const BG = "#1f1f22";
const PANEL = "#26262a";
const TEXT = "#f1f1f3";
const DIM = "#a6a7ab";
const EMBER = "#f28c5c";
const PAD = 64;
const MAP = 440;

const NUMBER = new Intl.NumberFormat("pt-BR");
const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

const bytes = (base64: string) => Buffer.from(base64, "base64");
const fonts = [
	{ name: "Inter", data: bytes(interRegular), weight: 400, style: "normal" },
	{ name: "Inter", data: bytes(interBold), weight: 700, style: "normal" },
] as const;

// resvg's wasm can be initialised once per process; dev reloads re-run this module.
const resvgReady = Symbol.for("focosbr.resvgReady");
const flags = globalThis as { [resvgReady]?: Promise<void> };

let outlines: Outlines | undefined;

/** The flame from favicon.svg. */
function Mark({ size }: { size: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
			<path
				d="M16 4c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 4 2 5 1-4 0-8 1-12z"
				fill="#d9431e"
			/>
			<path d="M16 17c0 3 3 4 3 7a3 3 0 0 1-6 0c0-2 2-3 3-7z" fill={EMBER} />
		</svg>
	);
}

/** PNG bytes for a view's card. */
export async function fireCard(
	view: CardView,
): Promise<Uint8Array<ArrayBuffer>> {
	const search = CardViewSchema.parse(view);
	const hours = search.h ?? 24;
	const historyId = cardHistoryId(
		search,
		(label) => {
			const p = splitPlaceLabel(label);
			return p ? municipalities.find(p.uf, slugify(p.name))?.id : undefined;
		},
		(name) => biomeByName(name)?.slug,
	);
	const [data, ytd] = await Promise.all([
		getFires(hours),
		historyId ? loadYtd(historyId) : null,
	]);
	const filters = {
		sensors: search.sensor,
		uf: search.state,
		biome: search.biome,
		place: search.city,
	};
	const indices = selectFires(data, filters);
	const summary = summarize(data, filters);

	outlines ??= JSON.parse(outlinesText) as Outlines;
	const project = projector(cardBounds(outlines, search.state), MAP, MAP);
	const size = { width: MAP, height: MAP };
	const states = outlinePath(outlines, project);
	const selected = search.state
		? outlinePath(outlines, project, (uf) => uf === search.state)
		: "";
	const dots = cardDots(
		data,
		indices,
		project,
		size,
		Date.parse(data.generatedAt),
	);
	const sensors = search.sensor?.length
		? ` · ${search.sensor.map((s) => SENSOR_LABELS[s]).join(", ")}`
		: "";
	const updated = data.sourceUpdatedAt
		? `atualizado às ${CLOCK.format(new Date(data.sourceUpdatedAt))} (Brasília)`
		: "";

	const node = (
		// Satori adds padding outside width/height, so the margin comes from
		// centring a box the size of the content area instead.
		<div
			style={{
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: BG,
				color: TEXT,
				fontFamily: "Inter",
			}}
		>
			<div
				style={{
					width: CARD_WIDTH - 2 * PAD,
					height: CARD_HEIGHT - 2 * PAD,
					display: "flex",
					gap: 40,
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						flex: 1,
						minWidth: 0,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
						<Mark size={44} />
						<div style={{ fontSize: 34, fontWeight: 700 }}>FocosBR</div>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						<div style={{ fontSize: 30, color: EMBER, fontWeight: 700 }}>
							{regionLabel(search)}
							{sensors}
						</div>
						<div style={{ fontSize: 28, color: DIM }}>cerca de</div>
						<div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
							<div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1 }}>
								{NUMBER.format(summary.fires)}
							</div>
							<div style={{ fontSize: 40, fontWeight: 700 }}>
								{summary.fires === 1 ? "fogo" : "fogos"}
							</div>
						</div>
						<div style={{ fontSize: 26, color: DIM }}>
							{`${NUMBER.format(summary.total)} ${summary.total === 1 ? "foco detectado" : "focos detectados"} nas últimas ${hours} horas`}
						</div>
						{ytd?.ratio != null && (
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: 4,
									marginTop: 14,
								}}
							>
								<div style={{ fontSize: 30, fontWeight: 700 }}>
									{`No ano, ${versusAverage(ytd.ratio)}`}
								</div>
								<div style={{ fontSize: 22, color: DIM }}>
									{`${NUMBER.format(ytd.current)} focos desde 1º de janeiro (satélite de referência)`}
								</div>
							</div>
						)}
					</div>
					<div style={{ display: "flex", fontSize: 20, color: DIM }}>
						{`Dados: INPE, Programa Queimadas${updated ? ` · ${updated}` : ""}`}
					</div>
				</div>
				<div
					style={{
						display: "flex",
						width: MAP,
						height: MAP,
						alignSelf: "center",
						background: PANEL,
						borderRadius: 20,
					}}
				>
					<svg
						width={MAP}
						height={MAP}
						viewBox={`0 0 ${MAP} ${MAP}`}
						aria-hidden="true"
					>
						<path d={states} fill="#2f2f34" stroke="#55555c" strokeWidth={1} />
						{selected && (
							<path
								d={selected}
								fill="#3a3a40"
								stroke="#c9c9cc"
								strokeWidth={2}
							/>
						)}
						{dots.map((d, k) => (
							<circle
								// biome-ignore lint/suspicious/noArrayIndexKey: static render, never reordered.
								key={k}
								cx={d.x}
								cy={d.y}
								r={search.state ? 3 : 2.2}
								fill={d.color}
							/>
						))}
					</svg>
				</div>
			</div>
		</div>
	);

	flags[resvgReady] ??= initWasm(bytes(resvgWasm));
	await flags[resvgReady];
	const svg = await satori(node, {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts: [...fonts],
	});
	return new Uint8Array(
		new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } })
			.render()
			.asPng(),
	);
}
