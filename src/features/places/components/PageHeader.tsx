import { Anchor, Group, Text } from "@mantine/core";
import { FireIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { SearchButton } from "~/features/places/components/SearchButton";
import { CopyLinkButton } from "~/features/share/components/CopyLinkButton";
import { ColorSchemeToggle } from "~/features/theme/components/ColorSchemeToggle";

/** Header for the content pages (states, a state, a city). */
export function PageHeader() {
	return (
		<Group justify="space-between" wrap="nowrap" mb="lg">
			<Group gap="sm" wrap="nowrap">
				{/* On phones only the icon shows; the label keeps the link named. */}
				<Anchor
					renderRoot={(props) => <Link {...props} to="/" />}
					aria-label="FocosBR"
					underline="never"
					c="inherit"
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
				{/* The logo links to the map too; phones keep the room for the rest. */}
				<Anchor
					renderRoot={(props) => <Link {...props} to="/" />}
					size="sm"
					visibleFrom="xs"
				>
					Mapa
				</Anchor>
				<Anchor
					renderRoot={(props) => <Link {...props} to="/states" />}
					size="sm"
				>
					Estados
				</Anchor>
				<Anchor
					renderRoot={(props) => <Link {...props} to="/rankings" />}
					size="sm"
				>
					Rankings
				</Anchor>
			</Group>
			<Group gap="xs" wrap="nowrap">
				<SearchButton />
				<CopyLinkButton />
				<ColorSchemeToggle />
			</Group>
		</Group>
	);
}
