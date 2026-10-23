import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't load the TanStack Start plugin.
export default defineConfig({
	resolve: {
		alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: { include: ["src/**/*.test.ts"] },
});
