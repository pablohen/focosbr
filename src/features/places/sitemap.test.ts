import { describe, expect, it } from "vitest";
import { sitemapPaths, sitemapXml } from "./sitemap";

describe("sitemapPaths", () => {
	it("lists home, the index, every state and the given cities", () => {
		const paths = sitemapPaths([
			{ id: 1500602, name: "Altamira", uf: "PA" },
			{ id: 1, name: "São Félix do Xingu", uf: "PA" },
		]);
		expect(paths.slice(0, 2)).toEqual(["/", "/states"]);
		expect(paths.filter((p) => p.startsWith("/states/"))).toHaveLength(27);
		expect(paths.slice(-2)).toEqual([
			"/cities/pa/altamira",
			"/cities/pa/sao-felix-do-xingu",
		]);
	});
});

describe("sitemapXml", () => {
	it("writes one escaped <url> per entry", () => {
		const xml = sitemapXml(["https://x/a?b=1&c=2"]);
		expect(xml).toContain("<loc>https://x/a?b=1&#38;c=2</loc>");
		expect(xml.match(/<url>/g)).toHaveLength(1);
	});
});
