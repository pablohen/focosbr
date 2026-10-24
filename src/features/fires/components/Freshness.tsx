import { Group, Text } from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { ClockIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { formatAgo, freshness } from "../view";

const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

/**
 * How old INPE's data is, ticking every minute; warns when the feed has
 * stopped updating, so an empty-looking map isn't read as "no fires".
 */
export function Freshness({
	sourceUpdatedAt,
}: {
	sourceUpdatedAt: string | null;
}) {
	const [now, setNow] = useState(() => Date.now());
	useInterval(() => setNow(Date.now()), 60_000, { autoInvoke: true });
	const age = freshness(sourceUpdatedAt, now);
	if (!sourceUpdatedAt || !age) return null;
	const at = CLOCK.format(new Date(sourceUpdatedAt));
	return (
		<Group gap={6} wrap="nowrap" c={age.stale ? "orange" : "dimmed"}>
			{age.stale ? (
				<WarningCircleIcon size={16} weight="bold" aria-hidden />
			) : (
				<ClockIcon size={16} aria-hidden />
			)}
			<Text size="xs" c="inherit" fw={age.stale ? 600 : undefined}>
				{age.stale
					? `Dados do INPE atrasados: última atualização às ${at} (${formatAgo(age.minutes)})`
					: `INPE atualizou às ${at} (${formatAgo(age.minutes)})`}
			</Text>
		</Group>
	);
}
