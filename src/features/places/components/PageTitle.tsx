import { Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * A page's title block, the same everywhere: optional breadcrumbs above,
 * the title, a lead (the page's main statement, in body text) and a note
 * (method or how to use the page, small and muted).
 */
export function PageTitle({
	above,
	title,
	lead,
	note,
	children,
}: {
	above?: ReactNode;
	title: ReactNode;
	lead?: ReactNode;
	note?: ReactNode;
	/** Anything after the note (a feed link, the window control). */
	children?: ReactNode;
}) {
	return (
		<Stack gap={4}>
			{above}
			<Title order={1} size="h2">
				{title}
			</Title>
			{lead && <Text>{lead}</Text>}
			{note && (
				<Text size="sm" c="dimmed">
					{note}
				</Text>
			)}
			{children}
		</Stack>
	);
}
