import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import type { HourBucket } from "../view";

const NUMBER = new Intl.NumberFormat("pt-BR");
const HOUR = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});
const DAY_HOUR = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

const HEIGHT = 64;

/**
 * Detections per hour, one column each. Peaks follow satellite passes
 * (VIIRS and MODIS overfly Brazil at set times), so the shape shows both
 * fire activity and when the satellites looked.
 */
export function HourlyChart({ buckets }: { buckets: HourBucket[] }) {
	const max = Math.max(1, ...buckets.map((b) => b.count));
	const first = buckets[0];
	const peak = buckets.reduce(
		(a, b) => (b.count > a.count ? b : a),
		buckets[0] ?? { start: 0, count: 0 },
	);
	if (!first) return null;
	return (
		<Stack gap={4}>
			<Group justify="space-between" align="baseline">
				<Text size="sm" fw={600}>
					Focos por hora
				</Text>
				<Text size="xs" c="dimmed">
					pico {NUMBER.format(peak.count)} às {HOUR.format(peak.start)}
				</Text>
			</Group>
			<Box
				role="img"
				aria-label={`Focos por hora; pico de ${NUMBER.format(peak.count)} às ${HOUR.format(peak.start)}`}
				h={HEIGHT}
				style={{
					display: "flex",
					alignItems: "flex-end",
					gap: 2,
					borderBottom: "1px solid var(--mantine-color-default-border)",
				}}
			>
				{buckets.map((b) => (
					<Tooltip
						key={b.start}
						label={`${DAY_HOUR.format(b.start)} · ${NUMBER.format(b.count)} ${b.count === 1 ? "foco" : "focos"}`}
						withArrow
						openDelay={0}
					>
						{/* The whole column is the hover target, not just the bar. */}
						<Box
							h="100%"
							style={{
								flex: 1,
								maxWidth: 24,
								display: "flex",
								alignItems: "flex-end",
							}}
						>
							<Box
								w="100%"
								h={b.count ? Math.max(2, (b.count / max) * HEIGHT) : 0}
								bg="var(--chart-bar)"
								style={{ borderRadius: "2px 2px 0 0" }}
							/>
						</Box>
					</Tooltip>
				))}
			</Box>
			<Group justify="space-between">
				<Text size="xs" c="dimmed">
					{DAY_HOUR.format(first.start)}
				</Text>
				<Text size="xs" c="dimmed">
					agora
				</Text>
			</Group>
		</Stack>
	);
}
