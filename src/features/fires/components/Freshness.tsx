import { Group, Text } from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { ClockIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { formatAgo, freshness } from "../view";

const CLOCK = new Intl.DateTimeFormat("pt-BR", {
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

/**
 * How old INPE's data is, ticking every minute; warns when the feed has
 * stopped updating, so an empty-looking map isn't read as "no fires".
 *
 * On server-rendered pages, pass `renderedAt` (the server's time): the
 * first render then reads the same on server and client, and the clock
 * takes over after hydration. Without it, "há 4 min" on the server and
 * "há 5 min" in the browser fail hydration across a minute boundary.
 */
export function Freshness({
	sourceUpdatedAt,
	renderedAt,
}: {
	sourceUpdatedAt: string | null;
	/** ISO time the server rendered at; omit for client-only renders. */
	renderedAt?: string;
}) {
	const [now, setNow] = useState(() =>
		renderedAt ? Date.parse(renderedAt) : Date.now(),
	);
	useEffect(() => setNow(Date.now()), []);
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
