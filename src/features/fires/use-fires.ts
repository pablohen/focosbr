import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FiresResponseSchema, type Window } from "./schemas";

/** INPE rewrites its file through the day; the API caches for 5 minutes. */
const REFRESH_MS = 5 * 60_000;

async function fetchFires(hours: Window, signal: AbortSignal) {
	const res = await fetch(`/api/fires?h=${hours}`, { signal });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return FiresResponseSchema.parse(await res.json());
}

/**
 * Hotspots for the window. Each window is cached, so switching back is
 * instant; data refreshes every 5 minutes while the tab is visible and
 * whenever it comes back into focus. While a new window loads, the previous
 * one stays on screen (`data.hours` says which window is shown).
 */
export function useFires(hours: Window) {
	const query = useQuery({
		queryKey: ["fires", hours],
		queryFn: ({ signal }) => fetchFires(hours, signal),
		refetchInterval: REFRESH_MS,
		// Fresh enough that refocusing a tab within a minute doesn't refetch.
		staleTime: 60_000,
		placeholderData: keepPreviousData,
	});
	return {
		data: query.data,
		/** A first load that failed: there's nothing to show. */
		error: query.data ? null : query.error,
		/** A refresh failed; `data` is from `updatedAt`. */
		refreshFailed: query.isRefetchError,
		updatedAt: query.dataUpdatedAt,
		loading: query.isFetching,
	};
}
