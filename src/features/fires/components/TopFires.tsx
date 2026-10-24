import {
	Group,
	SegmentedControl,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { useMemo, useState } from "react";
import type { FiresResponse } from "../schemas";
import {
	type FireGroups,
	type TopFire,
	type TopFireOrder,
	topFires,
} from "../view";

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

/** "1 h 20 min", "35 min", or "uma passagem" for a single satellite pass. */
function duration(first: Date, last: Date): string {
	const minutes = Math.round((last.getTime() - first.getTime()) / 60_000);
	if (minutes < 1) return "uma passagem";
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * The biggest estimated fires for the current filters. Each row zooms the
 * map to the fire and opens its newest detection.
 */
export function TopFires({
	data,
	groups,
	onSelect,
}: {
	data: FiresResponse;
	groups: FireGroups;
	onSelect: (fire: TopFire) => void;
}) {
	const [order, setOrder] = useState<TopFireOrder>("count");
	const fires = useMemo(
		() => topFires(data, groups, order),
		[data, groups, order],
	);
	if (fires.length === 0) return null;
	return (
		<Stack gap={6}>
			<Group justify="space-between" wrap="nowrap">
				<Text size="sm" fw={600}>
					Maiores fogos
				</Text>
				<SegmentedControl
					size="xs"
					value={order}
					onChange={(v) => setOrder(v as TopFireOrder)}
					data={[
						{ value: "count", label: "Detecções" },
						{ value: "frp", label: "Potência" },
					]}
					aria-label="Ordenar maiores fogos por"
				/>
			</Group>
			<Stack gap={2} component="ol" m={0} p={0} style={{ listStyle: "none" }}>
				{fires.map((fire, rank) => (
					<li key={fire.id}>
						<UnstyledButton
							w="100%"
							px={6}
							py={4}
							onClick={() => onSelect(fire)}
							style={{ borderRadius: "var(--mantine-radius-sm)" }}
							className="top-fire"
						>
							<Group gap={8} wrap="nowrap" align="baseline">
								<Text size="xs" c="dimmed" w={16} ta="right">
									{rank + 1}
								</Text>
								<Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
									<Text size="sm" fw={600} truncate>
										{fire.place}
									</Text>
									<Text size="xs" c="dimmed">
										{NUMBER.format(fire.count)}{" "}
										{fire.count === 1 ? "detecção" : "detecções"}
										{fire.totalFrp !== null &&
											` · ${NUMBER.format(fire.totalFrp)} MW`}
										{` · ${duration(fire.first, fire.last)}, até ${CLOCK.format(fire.last)}`}
									</Text>
								</Stack>
							</Group>
						</UnstyledButton>
					</li>
				))}
			</Stack>
			<Text size="xs" c="dimmed">
				Detecções medem extensão e duração; potência (soma do FRP), a
				intensidade. Nenhuma das duas é a área queimada.
			</Text>
		</Stack>
	);
}
