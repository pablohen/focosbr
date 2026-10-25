import { Anchor, Box, Group, Text } from "@mantine/core";
import { FireIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SearchButton } from "~/features/places/components/SearchButton";
import { CopyLinkButton } from "~/features/share/components/CopyLinkButton";
import { ColorSchemeToggle } from "~/features/theme/components/ColorSchemeToggle";

/** Where each header link counts as the current section. */
const NAV = [
	{ to: "/", label: "Mapa", match: (p: string) => p === "/", phones: false },
	{
		to: "/states",
		label: "Estados",
		match: (p: string) => p.startsWith("/states") || p.startsWith("/cities"),
		phones: true,
	},
	{
		to: "/rankings",
		label: "Rankings",
		match: (p: string) => p.startsWith("/rankings"),
		phones: true,
	},
] as const;

function NavLink({
	to,
	active,
	children,
	phones,
}: {
	to: (typeof NAV)[number]["to"];
	active: boolean;
	children: ReactNode;
	phones: boolean;
}) {
	return (
		<Anchor
			renderRoot={(props) => <Link {...props} to={to} />}
			size="sm"
			// The current section reads as text, not a link to itself.
			fw={active ? 700 : undefined}
			c={active ? "var(--mantine-color-text)" : undefined}
			underline={active ? "never" : "hover"}
			aria-current={active ? "page" : undefined}
			visibleFrom={phones ? undefined : "xs"}
			// A taller hit area than the text, for touch.
			py={8}
		>
			{children}
		</Anchor>
	);
}

/**
 * The one header of the site, on the map and every page: logo, sections
 * (the current one marked), search, copy link and theme. Full width with a
 * bottom border, so it doesn't move between the map and the pages. Inside
 * the map's AppShell, `bare` drops its own border (the shell draws one).
 */
export function SiteHeader({ bare = false }: { bare?: boolean }) {
	const { pathname } = useLocation();
	return (
		<Box
			component="header"
			h={56}
			px={{ base: "xs", sm: "md" }}
			style={
				bare
					? undefined
					: { borderBottom: "1px solid var(--mantine-color-default-border)" }
			}
		>
			<Group h="100%" justify="space-between" wrap="nowrap">
				<Group gap="sm" wrap="nowrap">
					{/* On phones only the icon shows; the label keeps the link named. */}
					<Anchor
						renderRoot={(props) => <Link {...props} to="/" />}
						aria-label="FocosBR"
						underline="never"
						c="inherit"
						mr={{ base: 2, sm: "xs" }}
						style={{ display: "flex", alignItems: "center", gap: 8 }}
					>
						<FireIcon
							size={26}
							weight="duotone"
							color="var(--mantine-primary-color-filled)"
							aria-hidden
						/>
						<Text fw={700} fz="h4" visibleFrom="xs">
							FocosBR
						</Text>
					</Anchor>
					{NAV.map((n) => (
						<NavLink
							key={n.to}
							to={n.to}
							active={n.match(pathname)}
							phones={n.phones}
						>
							{n.label}
						</NavLink>
					))}
					<Text size="sm" c="dimmed" visibleFrom="lg" ml="xs">
						Focos de calor detectados por satélite, quase em tempo real
					</Text>
				</Group>
				<Group gap="xs" wrap="nowrap">
					<SearchButton />
					<CopyLinkButton />
					<ColorSchemeToggle />
				</Group>
			</Group>
		</Box>
	);
}
