import {
	Anchor,
	Box,
	Button,
	CloseButton,
	Group,
	Paper,
	SegmentedControl,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { createSpotlight } from "@mantine/spotlight";
import { PlusIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { getCompare } from "~/features/compare/compare.functions";
import {
	CompareChart,
	slotColor,
} from "~/features/compare/components/CompareChart";
import { CompareSearchSchema } from "~/features/compare/schemas";
import { compareLines } from "~/features/compare/series";
import {
	addSlot,
	MAX_PLACES,
	parseSlots,
	removeSlot,
	serializeSlots,
} from "~/features/compare/slots";
import { percentVsAverage, ytdPeriod } from "~/features/history/format";
import { FIRST_YEAR } from "~/features/history/schemas";
import { PageShell } from "~/features/places/components/PageShell";
import { PageTitle } from "~/features/places/components/PageTitle";
import { entryKey } from "~/features/places/search";
import { absoluteUrl } from "~/lib/site";
import { LIST_TABLE } from "~/lib/tables";

const PlaceSearch = lazy(
	() => import("~/features/places/components/PlaceSearch"),
);
const [pickerStore, picker] = createSpotlight();

const NUMBER = new Intl.NumberFormat("pt-BR");
const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;
const TITLE = "Comparar lugares · FocosBR";

const SUGGESTIONS = [
	{ label: "Pará × Mato Grosso", places: "pa,mt" },
	{
		label: "Amazônia × Cerrado × Pantanal",
		places: "biome/amazonia,biome/cerrado,biome/pantanal",
	},
	{
		label: "Altamira × São Félix do Xingu",
		places: "pa/altamira,pa/sao-felix-do-xingu",
	},
];

/**
 * /compare?places=pa,mt: up to three places' fire seasons side by side, in
 * counts or as a share of each one's average year. Colours keep to slots.
 */
export const Route = createFileRoute("/compare")({
	validateSearch: CompareSearchSchema,
	loaderDeps: ({ search }) => ({ places: search.places }),
	loader: ({ deps }) =>
		getCompare({ data: { slots: parseSlots(deps.places) } }),
	head: ({ loaderData }) => {
		const names = (loaderData ?? []).flatMap((p) => (p ? [p.name] : []));
		return {
			meta: [
				{ title: names.length ? `${names.join(" × ")} · FocosBR` : TITLE },
				{
					name: "description",
					content:
						"Compare a temporada de queimadas de estados, municípios e biomas: focos acumulados no ano e a média desde 2003, com dados do INPE.",
				},
				{ property: "og:title", content: TITLE },
			],
			links: [{ rel: "canonical", href: absoluteUrl("/compare") }],
		};
	},
	component: ComparePage,
});

function ComparePage() {
	const places = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const [pickerLoaded, setPickerLoaded] = useState(false);
	const slots = parseSlots(search.places);
	const scale = search.scale ?? "count";
	const setSlots = (next: typeof slots) =>
		navigate({ search: (s) => ({ ...s, places: serializeSlots(next) }) });
	const shown = places.flatMap((p, slot) => (p ? [{ ...p, slot }] : []));
	const lines = compareLines(places, scale === "index" ? "index" : "count");
	const year =
		shown.find((p) => p.season)?.season?.current.year ??
		new Date().getFullYear();
	const through = shown.find((p) => p.ytd)?.ytd?.through;
	const full = slots.filter(Boolean).length >= MAX_PLACES;
	const openPicker = () => {
		setPickerLoaded(true);
		picker.open();
	};

	return (
		<PageShell>
			<Stack gap="lg">
				<PageTitle
					title="Comparar lugares"
					lead={`Até ${MAX_PLACES} estados, municípios ou biomas: focos do satélite de referência acumulados no ano, contra a média de cada um desde ${FIRST_YEAR}.`}
				/>

				<Group gap="xs">
					{shown.map((p) => (
						<Paper key={p.key} withBorder radius="xl" py={4} pl="sm" pr={4}>
							<Group gap={6} wrap="nowrap">
								<Box
									w={10}
									h={10}
									bg={slotColor(p.slot)}
									style={{ borderRadius: 5 }}
								/>
								<Anchor
									renderRoot={(props) => <Link {...props} to={p.path} />}
									size="sm"
									c="inherit"
								>
									{p.name}
								</Anchor>
								<CloseButton
									size="md"
									aria-label={`Remover ${p.name}`}
									onClick={() => setSlots(removeSlot(slots, p.slot))}
								/>
							</Group>
						</Paper>
					))}
					<Button
						size="xs"
						variant="default"
						leftSection={<PlusIcon size={14} />}
						onClick={openPicker}
						disabled={full}
					>
						{full ? `Até ${MAX_PLACES} lugares` : "Adicionar lugar"}
					</Button>
				</Group>

				{shown.length === 0 ? (
					<Stack gap={4}>
						<Text size="sm">Comece por um destes, ou adicione os seus:</Text>
						{SUGGESTIONS.map((s) => (
							<Anchor
								key={s.places}
								size="sm"
								renderRoot={(props) => (
									<Link
										{...props}
										to="/compare"
										search={{ places: s.places }}
									/>
								)}
							>
								{s.label}
							</Anchor>
						))}
					</Stack>
				) : (
					<>
						<Table {...LIST_TABLE}>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Lugar</Table.Th>
									<Table.Th ta="right">No ano</Table.Th>
									<Table.Th ta="right">Média</Table.Th>
									<Table.Th ta="right">vs. média</Table.Th>
									<Table.Th ta="right">24 h</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{shown.map((p) => (
									<Table.Tr key={p.key}>
										<Table.Td>
											<Group gap={6} wrap="nowrap">
												<Box
													w={8}
													h={8}
													bg={slotColor(p.slot)}
													style={{ borderRadius: 4 }}
												/>
												{p.name}
											</Group>
										</Table.Td>
										<Table.Td ta="right" style={NUMERIC}>
											{p.ytd ? NUMBER.format(p.ytd.current) : "—"}
										</Table.Td>
										<Table.Td ta="right" style={NUMERIC}>
											{p.ytd ? NUMBER.format(Math.round(p.ytd.average)) : "—"}
										</Table.Td>
										<Table.Td ta="right" style={NUMERIC}>
											{p.ytd?.ratio != null
												? percentVsAverage(p.ytd.ratio)
												: "—"}
										</Table.Td>
										<Table.Td ta="right" style={NUMERIC}>
											{NUMBER.format(p.total)}
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
						{through && (
							<Text size="xs" c="dimmed" mt={-12}>
								“No ano” e “Média”: de {ytdPeriod(through)}, satélite de
								referência. “24 h”: focos de todos os satélites nas últimas 24
								horas.
							</Text>
						)}
						<SegmentedControl
							size="xs"
							w="fit-content"
							value={scale}
							onChange={(v) =>
								navigate({
									search: (s) => ({
										...s,
										scale: v === "index" ? "index" : undefined,
									}),
									replace: true,
								})
							}
							data={[
								{ value: "count", label: "Focos" },
								{ value: "index", label: "% do ano médio" },
							]}
							aria-label="Escala do gráfico"
						/>
						{lines.length > 0 ? (
							<CompareChart
								lines={lines}
								scale={scale === "index" ? "index" : "count"}
								year={year}
								firstYear={FIRST_YEAR}
							/>
						) : (
							<Text size="sm" c="dimmed">
								Histórico indisponível para estes lugares no momento.
							</Text>
						)}
						{scale === "index" && (
							<Text size="xs" c="dimmed">
								100% é o total de um ano médio do lugar (de {FIRST_YEAR} a{" "}
								{year - 1}), o que põe lugares de tamanhos diferentes na mesma
								escala.
							</Text>
						)}
					</>
				)}
			</Stack>
			{pickerLoaded && (
				<Suspense fallback={null}>
					<PlaceSearch
						store={pickerStore}
						placeholder="Adicionar estado, bioma ou município"
						onPick={(e) => setSlots(addSlot(slots, entryKey(e)))}
					/>
				</Suspense>
			)}
		</PageShell>
	);
}
