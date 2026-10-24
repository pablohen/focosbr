import {
	ActionIcon,
	Button,
	Group,
	Slider,
	Text,
	Tooltip,
	VisuallyHidden,
} from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import type { HourBucket } from "../view";

/** One hour of the window per tick while playing. */
const STEP_MS = 700;

const DAY_HOUR = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

/** End of bucket `k`, in Unix seconds: the "up to" time it stands for. */
const endOf = (b: HourBucket) => (b.start + 3_600_000) / 1000;

/**
 * Replays the window hour by hour. `until` (Unix seconds) is the end of the
 * chosen hour, or null for live; the last position is live too.
 */
export function Timeline({
	buckets,
	until,
	onChange,
}: {
	buckets: HourBucket[];
	until: number | null;
	onChange: (until: number | null) => void;
}) {
	const last = buckets.length - 1;
	const index =
		until === null ? last : buckets.findIndex((b) => endOf(b) >= until);
	const value = index < 0 ? last : index;

	const toIndex = (k: number) => {
		const b = buckets[k];
		onChange(k >= last || !b ? null : endOf(b));
	};
	const player = useInterval(() => {
		if (value >= last) player.stop();
		else toIndex(value + 1);
	}, STEP_MS);
	// Reaching live (or being sent there) ends the replay.
	useEffect(() => {
		if (until === null && player.active) player.stop();
	}, [until, player]);

	const play = () => {
		// From live, a replay starts at the beginning of the window.
		if (value >= last) toIndex(0);
		player.start();
	};
	const label = (k: number) => {
		const b = buckets[k];
		return k >= last || !b
			? "agora"
			: `até ${DAY_HOUR.format(endOf(b) * 1000)}`;
	};

	if (buckets.length < 2) return null;
	return (
		<Group gap="xs" wrap="nowrap" align="center">
			<Tooltip label={player.active ? "Pausar" : "Reproduzir hora a hora"}>
				<ActionIcon
					variant="light"
					size="md"
					onClick={player.active ? player.stop : play}
					aria-label={player.active ? "Pausar" : "Reproduzir hora a hora"}
				>
					{player.active ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
				</ActionIcon>
			</Tooltip>
			<Slider
				style={{ flex: 1 }}
				size="sm"
				min={0}
				max={last}
				step={1}
				value={value}
				onChange={(k) => {
					player.stop();
					toIndex(k);
				}}
				label={label}
				thumbLabel="Momento do período"
			/>
			{/* Mantine's thumb only exposes the index; announce the time instead. */}
			<VisuallyHidden aria-live="polite">{label(value)}</VisuallyHidden>
			{until === null ? (
				<Text size="xs" c="dimmed" w={48} ta="right">
					agora
				</Text>
			) : (
				<Button
					size="compact-xs"
					variant="subtle"
					w={48}
					px={0}
					onClick={() => {
						player.stop();
						onChange(null);
					}}
				>
					agora
				</Button>
			)}
		</Group>
	);
}
