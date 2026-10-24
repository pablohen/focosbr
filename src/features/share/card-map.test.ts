import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FiresResponse } from "../fires/schemas";
import {
	BRAZIL,
	cardBounds,
	cardDots,
	dotsPath,
	type Outlines,
	outlinePath,
	projector,
} from "./card-map";

const outlines: Outlines = JSON.parse(
	readFileSync("public/data/state-outlines.geojson", "utf8"),
);

describe("projector", () => {
	it("fits the box, centred, north up", () => {
		const project = projector([0, 0, 10, 10], 100, 100);
		const [x0, y0] = project(0, 10);
		const [x1, y1] = project(10, 0);
		expect(y0).toBeCloseTo(0);
		expect(y1).toBeCloseTo(100);
		// Near the equator, 10° wide ≈ 10° tall, so it spans the width too.
		expect(x1 - x0).toBeCloseTo(100 * Math.cos((5 * Math.PI) / 180), 0);
		expect((x0 + x1) / 2).toBeCloseTo(50);
	});
});

describe("outlinePath", () => {
	it("draws Brazil compactly", () => {
		const d = outlinePath(outlines, projector(BRAZIL, 500, 500));
		expect(d.startsWith("M")).toBe(true);
		expect(d.length).toBeLessThan(120_000);
	});
	it("can keep a single state", () => {
		const all = outlinePath(outlines, projector(BRAZIL, 500, 500));
		const pa = outlinePath(
			outlines,
			projector(BRAZIL, 500, 500),
			(uf) => uf === "PA",
		);
		expect(pa.length).toBeGreaterThan(0);
		expect(pa.length).toBeLessThan(all.length / 5);
	});
});

describe("cardBounds", () => {
	it("frames a state with a margin, or Brazil", () => {
		const [w, s, e, n] = cardBounds(outlines, "DF");
		expect(w).toBeLessThan(-48);
		expect(e).toBeGreaterThan(-47.4);
		expect(s).toBeLessThan(-16);
		expect(n).toBeGreaterThan(-15.5);
		expect(cardBounds(outlines)).toEqual(BRAZIL);
		expect(cardBounds(outlines, "XX")).toEqual(BRAZIL);
	});
});

describe("cardDots", () => {
	const data = {
		fires: {
			lon: [-50, -50, 10],
			lat: [-10, -10, 10],
			t: [0, 10 * 3600, 10 * 3600],
		},
	} as FiresResponse;
	const project = projector(BRAZIL, 500, 500);
	const size = { width: 500, height: 500 };

	it("colours by age, drops points outside the box, keeps the newest", () => {
		// At 12.5 h: one detection 12.5 h old (oldest band), one 2.5 h (newest).
		const now = 12.5 * 3600 * 1000;
		const dots = cardDots(data, [0, 1, 2], project, size, now);
		expect(dots.map((d) => d.color)).toEqual(["#f28c5c", "#8f1d0e"]);
		expect(cardDots(data, [0, 1], project, size, now, 1)).toHaveLength(1);
	});
});

describe("dotsPath", () => {
	it("draws each point as a zero-length segment", () => {
		expect(
			dotsPath([
				[1, 2],
				[3.25, 4],
			]),
		).toBe("M1.0 2.0h0M3.3 4.0h0");
		expect(dotsPath([])).toBe("");
	});
});

describe("outlinePath frame", () => {
	it("drops states outside the frame", () => {
		const project = projector([-49, -16.1, -47.3, -15.4], 200, 200); // DF
		const all = outlinePath(outlines, project);
		const framed = outlinePath(outlines, project, () => true, 1.5, {
			width: 200,
			height: 200,
		});
		expect(framed.length).toBeLessThan(all.length / 4);
	});
});
