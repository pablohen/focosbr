import { em } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

/**
 * True below Mantine's `sm` breakpoint (48em ≈ 768px), matching the
 * `hiddenFrom="sm"` / `visibleFrom="sm"` props used for static layout.
 * False during SSR and the first client render; prefer those CSS props for
 * anything visible on first paint and use this only for behaviour (drawer
 * position, dropdown width).
 */
export function useIsMobile(): boolean {
	return useMediaQuery(`(max-width: ${em(767.98)})`) ?? false;
}
