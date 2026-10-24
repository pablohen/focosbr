import { describe, expect, it } from "vitest";
import { FiresSearchSchema } from "./schemas";

describe("FiresSearchSchema", () => {
	it("keeps a valid map position", () => {
		expect(
			FiresSearchSchema.parse({ bbox: [-55.1, -12.2, -50.3, -8.4] }).bbox,
		).toEqual([-55.1, -12.2, -50.3, -8.4]);
	});
	it("drops a broken position instead of failing the page", () => {
		const broken = [
			[-50, -8, -55, -12], // west east of east
			[-55, 95, -50, 96], // latitude out of range
			[-55, -12, -50], // too short
			"oops",
		];
		for (const bbox of broken)
			expect(FiresSearchSchema.parse({ bbox, uf: "PA" })).toEqual({
				uf: "PA",
			});
	});
});
