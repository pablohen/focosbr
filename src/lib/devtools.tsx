import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

/**
 * TanStack's devtools panel, with Query (the fire data cache) and Router
 * (URL state) tabs. Development only: the root loads this module behind
 * `import.meta.env.DEV`, so production builds never include it.
 */
export default function Devtools() {
	return (
		<TanStackDevtools
			plugins={[
				{ name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
				{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
			]}
		/>
	);
}
