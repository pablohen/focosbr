import { Spotlight } from "@mantine/spotlight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { STATE_NAMES } from "~/features/fires/states";
import list from "../municipalities.json";
import { MunicipalityListSchema } from "../places";
import { type SearchEntry, searchIndex, searchPlaces } from "../search";
import { placeSearchStore } from "./search-store";

/**
 * The place search dialog. Loaded lazily the first time the search opens,
 * with IBGE's municipality list, so neither weighs on first paint.
 */
export default function PlaceSearch() {
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const index = useMemo(
		() => searchIndex(MunicipalityListSchema.parse(list)),
		[],
	);
	const hits = useMemo(() => searchPlaces(index, query), [index, query]);
	const go = (e: SearchEntry) => {
		if (e.kind === "state")
			return navigate({
				to: "/states/$state",
				params: { state: e.uf.toLowerCase() },
			});
		if (e.kind === "biome")
			return navigate({ to: "/biomes/$biome", params: { biome: e.slug } });
		return navigate({
			to: "/cities/$state/$city",
			params: { state: e.uf.toLowerCase(), city: e.slug },
		});
	};
	return (
		<Spotlight.Root
			store={placeSearchStore}
			query={query}
			onQueryChange={setQuery}
			shortcut={null}
		>
			<Spotlight.Search
				placeholder="Buscar estado, bioma ou município"
				leftSection={<MagnifyingGlassIcon size={18} />}
			/>
			<Spotlight.ActionsList>
				{hits.map((e) => (
					<Spotlight.Action
						key={`${e.kind}/${e.uf}/${e.slug}`}
						label={e.kind === "city" ? `${e.name} (${e.uf})` : e.name}
						description={
							e.kind === "state"
								? "Estado"
								: e.kind === "biome"
									? "Bioma"
									: `Município · ${STATE_NAMES[e.uf]}`
						}
						onClick={() => go(e)}
					/>
				))}
				{hits.length === 0 && (
					<Spotlight.Empty>
						{query.trim()
							? "Nenhum estado, bioma ou município encontrado."
							: "Digite o nome de um estado, bioma ou município."}
					</Spotlight.Empty>
				)}
			</Spotlight.ActionsList>
		</Spotlight.Root>
	);
}
