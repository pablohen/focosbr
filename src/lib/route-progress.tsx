import { NavigationProgress, nprogress } from "@mantine/nprogress";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/**
 * Mantine fades the bar in over 200 ms; most loads finish sooner, so it stays
 * (full) for at least this long or it would never show.
 */
const MIN_VISIBLE_MS = 400;

/** Runs the top progress bar while `active` is true. */
export function useProgress(active: boolean) {
	const finishing = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		if (!active) return;
		clearTimeout(finishing.current);
		const started = performance.now();
		nprogress.start();
		return () => {
			nprogress.set(100);
			finishing.current = setTimeout(
				() => nprogress.complete(),
				Math.max(0, MIN_VISIBLE_MS - (performance.now() - started)),
			);
		};
	}, [active]);
}

/**
 * A thin bar at the top while a page change loads. Search-param changes
 * (window, sensors) stay on the page and are skipped.
 */
export function RouteProgress() {
	const changingPage = useRouterState({
		select: (s) =>
			s.status === "pending" &&
			s.location.pathname !== s.resolvedLocation?.pathname,
	});
	useProgress(changingPage);
	return <NavigationProgress size={3} aria-hidden />;
}
