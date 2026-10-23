import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { MantineProvider, mantineHtmlProps } from "@mantine/core";
import mantineCss from "@mantine/core/styles.css?url";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
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
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
		],
	}),
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
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
					{children}
				</MantineProvider>
				<Scripts />
			</body>
		</html>
	);
}
