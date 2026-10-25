/**
 * Renders the app icons in public/icons from the flame in favicon.svg: the
 * home-screen icons (192, 512), a maskable one (the flame inside the safe
 * zone, full-bleed background) and Apple's touch icon. Re-run after
 * changing the logo.
 * Usage: pnpm icons
 */
import { readFileSync, writeFileSync } from "node:fs";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const BG = "#1f1f22";
const FLAME =
	'<path d="M16 4c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 4 2 5 1-4 0-8 1-12z" fill="#d9431e"/><path d="M16 17c0 3 3 4 3 7a3 3 0 0 1-6 0c0-2 2-3 3-7z" fill="#f28c5c"/>';

/** The flame on a square background, scaled to `scale` of the side. */
const svg = (scale: number, radius: number) => {
	const offset = (32 - 32 * scale) / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${radius}" fill="${BG}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${FLAME}</g></svg>`;
};

await initWasm(readFileSync("node_modules/@resvg/resvg-wasm/index_bg.wasm"));
const icons: [string, number, string][] = [
	["icon-192.png", 192, svg(0.9, 7)],
	["icon-512.png", 512, svg(0.9, 7)],
	// Maskable: launchers crop to a circle or squircle; keep the flame in
	// the middle 60% and let the background run to the edges.
	["icon-maskable-512.png", 512, svg(0.6, 0)],
	["apple-touch-icon.png", 180, svg(0.8, 0)],
];
for (const [name, size, source] of icons) {
	const png = new Resvg(source, { fitTo: { mode: "width", value: size } })
		.render()
		.asPng();
	writeFileSync(`public/icons/${name}`, png);
	console.log(`public/icons/${name}`);
}
