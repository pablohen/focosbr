import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// Regression: the daily forecast fetched IBGE's municipal mesh at run time,
// and IBGE's server doesn't answer GitHub's runners, so the History
// workflow failed. The mesh is committed (pnpm geo:centroids) instead.
describe("municipal mesh for the forecast", () => {
	it("is committed, complete and slim", () => {
		const mesh = JSON.parse(
			gunzipSync(readFileSync("data/municipal-mesh.json.gz")).toString("utf8"),
		) as {
			features: {
				properties: { codarea: string };
				geometry: { type: string };
			}[];
		};
		expect(mesh.features.length).toBeGreaterThan(5500);
		expect(mesh.features[0]?.properties).toEqual({
			codarea: expect.stringMatching(/^\d{7}$/),
		});
		expect(new Set(mesh.features.map((f) => f.geometry.type))).toEqual(
			new Set(["Polygon", "MultiPolygon"]),
		);
	});

	it("is read from the repo, not fetched from IBGE", () => {
		const script = readFileSync("scripts/forecast.ts", "utf8");
		expect(script).not.toContain("servicodados.ibge.gov.br");
		expect(script).toContain("data/municipal-mesh.json.gz");
	});
});
