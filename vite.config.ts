import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	plugins: [
		tanstackStart(),
		// Vercel when VERCEL=1, a standalone Node.js server in .output/ otherwise.
		// São Paulo: next to the users and INPE's data server.
		nitro({ vercel: { functions: { regions: ["gru1"], maxDuration: 30 } } }),
		viteReact(),
	],
});
