import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROUTES = "src/routes";

// Regression: the root route used to set a default <title>, which the
// 404 page then repeated alongside its own, so crawlers read the home
// page's title on missing pages. The root sets none now, so every page
// route must set its own (directly, or through pageHead/embedHead).
describe("route titles", () => {
	const pages = readdirSync(ROUTES).filter(
		(f) => f.endsWith(".tsx") && f !== "__root.tsx",
	);

	it("finds the page routes", () => {
		expect(pages.length).toBeGreaterThan(10);
	});

	it.each(pages)("%s sets its own title", (file) => {
		const source = readFileSync(`${ROUTES}/${file}`, "utf8");
		expect(source).toMatch(/\{ title|title:|pageHead\(|embedHead\(/);
	});

	it("the root sets no default title", () => {
		const root = readFileSync(`${ROUTES}/__root.tsx`, "utf8");
		const head = root.slice(
			root.indexOf("head: () => ({"),
			root.indexOf("component: RootComponent"),
		);
		expect(head).not.toMatch(/\{ title:/);
	});
});
