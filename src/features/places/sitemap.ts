import { STATE_NAMES } from "../fires/states";
import { FIRST_YEAR } from "../history/schemas";
import { BIOMES, biomePath } from "./biomes";
import { type Municipality, municipalityPath, statePath } from "./places";

/** Every page's path: home, the states index, the rankings, the biomes, each state and each city. */
export function sitemapPaths(
	cities: Municipality[],
	/** The last year with a /years page (the current one). */
	lastYear: number,
): string[] {
	return [
		"/",
		"/states",
		"/rankings",
		"/biomes",
		"/data",
		"/compare",
		"/alerts",
		"/week",
		"/years",
		...Array.from(
			{ length: lastYear - FIRST_YEAR + 1 },
			(_, i) => `/years/${FIRST_YEAR + i}`,
		),
		...BIOMES.map((b) => biomePath(b.slug)),
		...Object.keys(STATE_NAMES).sort().map(statePath),
		...cities.map((c) => municipalityPath(c.uf, c.name)),
	];
}

const escapeXml = (s: string) =>
	s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * A sitemap for absolute URLs. No <lastmod>: the numbers change all day,
 * so `changefreq` says so instead.
 */
export function sitemapXml(urls: string[]): string {
	const entries = urls
		.map(
			(u) =>
				`<url><loc>${escapeXml(u)}</loc><changefreq>hourly</changefreq></url>`,
		)
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}
