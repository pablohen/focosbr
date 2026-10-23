import { useEffect, useState } from "react";
import {
	type FiresResponse,
	FiresResponseSchema,
	type Window,
} from "./schemas";

/** INPE rewrites its file through the day; the API caches for 5 minutes. */
const REFRESH_MS = 5 * 60_000;

type State = { data?: FiresResponse; error?: unknown; loading: boolean };

/**
 * Hotspots for the window, refetched every few minutes. The previous data
 * stays on screen while a refresh or a window change is in flight.
 */
export function useFires(hours: Window): State {
	const [state, setState] = useState<State>({ loading: true });

	useEffect(() => {
		let alive = true;
		const controller = new AbortController();
		const load = async () => {
			setState((s) => ({ ...s, loading: true }));
			try {
				const res = await fetch(`/api/fires?h=${hours}`, {
					signal: controller.signal,
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = FiresResponseSchema.parse(await res.json());
				if (alive) setState({ data, loading: false });
			} catch (error) {
				if (alive) setState((s) => ({ ...s, error, loading: false }));
			}
		};
		load();
		const timer = setInterval(load, REFRESH_MS);
		return () => {
			alive = false;
			controller.abort();
			clearInterval(timer);
		};
	}, [hours]);

	return state;
}
