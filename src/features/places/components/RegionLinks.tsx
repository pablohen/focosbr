import { Anchor, type AnchorProps } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Window } from "../../fires/schemas";
import { windowSearch } from "../navigation";
import { slugify } from "../places";

type Common = AnchorProps & { hours?: Window; children: ReactNode };

/**
 * Typed links to region pages, styled as Mantine anchors. `renderRoot`
 * keeps TanStack Link's route typing, which `component={Link}` loses.
 */
export function StateLink({
	uf,
	hours = 24,
	children,
	...props
}: Common & { uf: string }) {
	return (
		<Anchor
			{...props}
			renderRoot={(root) => (
				<Link
					{...root}
					to="/states/$state"
					params={{ state: uf.toLowerCase() }}
					search={windowSearch(hours)}
				/>
			)}
		>
			{children}
		</Anchor>
	);
}

export function MunicipalityLink({
	uf,
	name,
	hours = 24,
	children,
	...props
}: Common & { uf: string; name: string }) {
	return (
		<Anchor
			{...props}
			renderRoot={(root) => (
				<Link
					{...root}
					to="/states/$state/$city"
					params={{ state: uf.toLowerCase(), city: slugify(name) }}
					search={windowSearch(hours)}
				/>
			)}
		>
			{children}
		</Anchor>
	);
}

export function BiomeLink({
	slug,
	hours = 24,
	children,
	...props
}: Common & { slug: string }) {
	return (
		<Anchor
			{...props}
			renderRoot={(root) => (
				<Link
					{...root}
					to="/biomes/$biome"
					params={{ biome: slug }}
					search={windowSearch(hours)}
				/>
			)}
		>
			{children}
		</Anchor>
	);
}
