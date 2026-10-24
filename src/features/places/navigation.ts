import { useNavigate } from "@tanstack/react-router";
import type { FiresSearch, Window } from "../fires/schemas";
import { slugify, splitPlaceLabel } from "./places";

/** The page for a region: a city's, a state's, or the home page. */
export function regionRoute(region: { uf?: string; place?: string }) {
	const place = region.place ? splitPlaceLabel(region.place) : null;
	if (place)
		return {
			to: "/cities/$state/$city",
			params: { state: place.uf.toLowerCase(), city: slugify(place.name) },
		} as const;
	if (region.uf)
		return {
			to: "/states/$state",
			params: { state: region.uf.toLowerCase() },
		} as const;
	return { to: "/" } as const;
}

/**
 * Navigation for the panel's region controls: goes to the region's page,
 * keeping the window, sensors and biome but not the map position (the new
 * page fits its region).
 */
export function useRegionNavigate(search: FiresSearch) {
	const navigate = useNavigate();
	return (region: { uf?: string; biome?: string; place?: string }) =>
		navigate({
			...regionRoute(region),
			search: { h: search.h, sensor: search.sensor, biome: region.biome },
		});
}

/** Search for links to region pages: only a non-default window. */
export const windowSearch = (hours: Window) =>
	hours === 24 ? {} : { h: hours };
