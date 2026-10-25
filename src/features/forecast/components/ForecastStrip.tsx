import {
	Box,
	Group,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { riskClass } from "~/features/fires/view";
import type { ForecastDay } from "../schemas";

const PERCENT = new Intl.NumberFormat("pt-BR", { style: "percent" });
const DECIMAL = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const WEEKDAY = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});
const SHORT = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "numeric",
	timeZone: "UTC",
});
const at = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** INPE's classes in order, matched to the calendar's validated ordinal ramp (--cal-1…5). */
const CLASS_STEP: Record<string, number> = {
	Mínimo: 1,
	Baixo: 2,
	Médio: 3,
	Alto: 4,
	Crítico: 5,
};

/**
 * INPE's fire-risk forecast for a region: one card per day from today on,
 * with the class of the mean risk and the share of the area at high or
 * critical risk. Says when the latest forecast is too old to show.
 */
export function ForecastStrip({
	forecast,
	name,
}: {
	forecast: { issued: string; days: ForecastDay[] };
	name: string;
}) {
	const issued = SHORT.format(at(forecast.issued));
	return (
		<Stack gap="xs">
			<Title order={2} size="h4">
				Risco de fogo previsto
			</Title>
			{forecast.days.length === 0 ? (
				<Text size="sm" c="dimmed">
					Sem previsão atual do INPE para {name}: a última foi emitida em{" "}
					{issued}.
				</Text>
			) : (
				<SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
					{forecast.days.map((d) => {
						const label = riskClass(d.mean);
						return (
							<Paper key={d.date} withBorder p="xs" radius="md">
								<Stack gap={2}>
									<Text size="xs" c="dimmed">
										{WEEKDAY.format(at(d.date))}
									</Text>
									<Group gap={6} wrap="nowrap">
										<Box
											w={10}
											h={10}
											bg={`var(--cal-${CLASS_STEP[label] ?? 3})`}
											style={{ borderRadius: 2, flexShrink: 0 }}
											aria-hidden
										/>
										<Text fw={700}>{label}</Text>
									</Group>
									<Text size="xs">
										{PERCENT.format(d.high)} da área em risco alto ou crítico
									</Text>
									<Text size="xs" c="dimmed">
										índice médio {DECIMAL.format(d.mean)}
									</Text>
								</Stack>
							</Paper>
						);
					})}
				</SimpleGrid>
			)}
			<Text size="xs" c="dimmed">
				Previsão do INPE emitida em {issued}. O risco de fogo é um índice de 0 a
				1 que combina dias sem chuva, temperatura, umidade e vegetação: indica o
				quanto a vegetação está propensa a queimar, não a chance de haver fogo.
			</Text>
		</Stack>
	);
}
