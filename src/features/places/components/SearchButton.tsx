import { ActionIcon, Tooltip } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useState } from "react";
import { placeSearch } from "./search-store";

const PlaceSearch = lazy(() => import("./PlaceSearch"));

/**
 * Opens the place search (also ⌘K / Ctrl+K). The dialog and the
 * municipality list load on first use.
 */
export function SearchButton() {
	const [loaded, setLoaded] = useState(false);
	const open = () => {
		setLoaded(true);
		placeSearch.open();
	};
	useHotkeys([["mod+K", open]]);
	return (
		<>
			<Tooltip label="Buscar estado, bioma ou município (⌘K)" withArrow>
				<ActionIcon
					variant="default"
					size="lg"
					onClick={open}
					aria-label="Buscar estado, bioma ou município"
				>
					<MagnifyingGlassIcon size={18} />
				</ActionIcon>
			</Tooltip>
			{loaded && (
				<Suspense fallback={null}>
					<PlaceSearch />
				</Suspense>
			)}
		</>
	);
}
