/**
 * MapLibre's compact attribution starts expanded and only collapses when the
 * map is dragged. These collapse it to its "i" button after a few seconds,
 * the same way MapLibre does, so the credits are seen, then get out of the
 * way and stay one tap away.
 */

export const ATTRIBUTION_AUTOHIDE_MS = 5_000;

type ClassList = Pick<DOMTokenList, "contains" | "remove">;

/** Collapses an expanded compact attribution; anything else is left alone. */
export function collapseAttribution(el: { classList: ClassList } | null) {
	if (
		el?.classList.contains("maplibregl-compact") &&
		el.classList.contains("maplibregl-compact-show")
	)
		el.classList.remove("maplibregl-compact-show");
}

/**
 * Collapses the attribution inside `container` after `ms`. Returns a cancel
 * function for when the map goes away first.
 */
export function autoHideAttribution(
	container: HTMLElement,
	ms = ATTRIBUTION_AUTOHIDE_MS,
): () => void {
	const timer = setTimeout(
		() =>
			collapseAttribution(container.querySelector(".maplibregl-ctrl-attrib")),
		ms,
	);
	return () => clearTimeout(timer);
}
