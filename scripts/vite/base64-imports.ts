import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/**
 * `import data from "file?base64"`: the file's bytes as a base64 string, for
 * binaries the server needs at runtime (fonts, wasm) without a filesystem
 * path that survives bundling. Types: src/base64.d.ts.
 */
export function base64Imports(): Plugin {
	const SUFFIX = "?base64";
	return {
		name: "focosbr:base64-imports",
		enforce: "pre",
		async resolveId(source, importer) {
			if (!source.endsWith(SUFFIX)) return null;
			const resolved = await this.resolve(
				source.slice(0, -SUFFIX.length),
				importer,
				{ skipSelf: true },
			);
			return resolved && `${resolved.id}${SUFFIX}`;
		},
		load(id) {
			if (!id.endsWith(SUFFIX)) return null;
			const data = readFileSync(id.slice(0, -SUFFIX.length)).toString("base64");
			return `export default ${JSON.stringify(data)};`;
		},
	};
}
