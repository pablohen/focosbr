import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query defaults for the app. Queries only run in the browser
 * (the fire payload is too big to embed in SSR HTML), so one client per
 * page load is enough.
 */
export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// Three tries with Query's backoff (1 s, 2 s, 4 s) before showing
				// an error; INPE and mobile networks drop requests now and then.
				retry: 3,
				refetchOnWindowFocus: true,
				// A window you left a while ago stays in memory for switching back.
				gcTime: 15 * 60_000,
			},
		},
	});
}
