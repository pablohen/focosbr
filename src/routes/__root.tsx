import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import {
	Anchor,
	Center,
	MantineProvider,
	mantineHtmlProps,
	Stack,
	Title,
} from "@mantine/core";
import mantineCss from "@mantine/core/styles.css?url";
import nprogressCss from "@mantine/nprogress/styles.css?url";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	ClientOnly,
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { createQueryClient } from "~/lib/query-client";
import { RouteProgress } from "~/lib/route-progress";
import appCss from "~/styles/app.css?url";
import { cssVariablesResolver, theme } from "~/theme";

/**
 * Same as Mantine's <ColorSchemeScript defaultColorScheme="auto" />, but via
 * ScriptOnce: React 19 warns when a hydrated component renders a <script>.
 */
const COLOR_SCHEME_SCRIPT = `try {
	var s = localStorage.getItem("mantine-color-scheme-value");
	var scheme = s === "light" || s === "dark" ? s : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	document.documentElement.setAttribute("data-mantine-color-scheme", scheme);
} catch (e) {}`;

// Vite turns `import.meta.env.DEV` into `false` in production builds, so the
// devtools module (and its dependencies) is dropped from them entirely.
const Devtools = import.meta.env.DEV
	? lazy(() => import("~/lib/devtools"))
	: null;

const DESCRIPTION =
	"Focos de calor detectados por satélite no Brasil nas últimas horas, com dados do INPE.";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "FocosBR · Focos de calor no Brasil agora" },
			{ name: "description", content: DESCRIPTION },
			{ name: "theme-color", content: "#1f1f22" },
			{ property: "og:site_name", content: "FocosBR" },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: "FocosBR" },
			{ property: "og:description", content: DESCRIPTION },
		],
		links: [
			{ rel: "stylesheet", href: mantineCss },
			{ rel: "stylesheet", href: nprogressCss },
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
		],
	}),
	component: RootComponent,
	notFoundComponent: NotFound,
});

function NotFound() {
	return (
		<Center h="100dvh">
			<Stack align="center" gap="xs">
				<Title order={1} size="h2">
					Página não encontrada
				</Title>
				<Anchor component={Link} to="/">
					Voltar ao mapa
				</Anchor>
			</Stack>
		</Center>
	);
}

function RootComponent() {
	const [queryClient] = useState(createQueryClient);
	return (
		<QueryClientProvider client={queryClient}>
			<RootDocument>
				<Outlet />
				{Devtools && (
					<ClientOnly>
						<Suspense>
							<Devtools />
						</Suspense>
					</ClientOnly>
				)}
			</RootDocument>
		</QueryClientProvider>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="pt-BR" {...mantineHtmlProps}>
			<head>
				<ScriptOnce>{COLOR_SCHEME_SCRIPT}</ScriptOnce>
				<HeadContent />
			</head>
			<body>
				<MantineProvider
					theme={theme}
					cssVariablesResolver={cssVariablesResolver}
					defaultColorScheme="auto"
				>
					<RouteProgress />
					{children}
				</MantineProvider>
				<Scripts />
			</body>
		</html>
	);
}
