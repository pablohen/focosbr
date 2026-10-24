import type { Window } from "../fires/schemas";

/** Search for links to region pages: only a non-default window. */
export const windowSearch = (hours: Window) =>
	hours === 24 ? {} : { h: hours };
