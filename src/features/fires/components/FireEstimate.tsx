import { Group, Text } from "@mantine/core";

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/**
 * The headline: the estimate of distinct fires ("≈ 2.935 fogos"), the
 * same size on the map's panel and on details pages. The raw detection
 * count goes right under it, wherever it's used.
 */
export function FireEstimate({ fires }: { fires: number }) {
	return (
		<Group gap={8} align="baseline" wrap="nowrap">
			<Text fz={44} fw={700} lh={1}>
				≈ {NUMBER.format(fires)}
			</Text>
			<Text fw={600}>{fires === 1 ? "fogo" : "fogos"}</Text>
		</Group>
	);
}
