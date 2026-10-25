import { Group, Paper, Text } from "@mantine/core";
import { CloudSlashIcon } from "@phosphor-icons/react";

/**
 * What a page shows when its data can't be loaded (the database or INPE
 * is down), the same everywhere: "Não foi possível carregar os rankings
 * agora…". `what` takes its article, so the sentence agrees.
 */
export function Unavailable({ what }: { what: string }) {
	return (
		<Paper withBorder radius="md" p="md">
			<Group gap="sm" wrap="nowrap" align="flex-start">
				<CloudSlashIcon size={20} aria-hidden style={{ flexShrink: 0 }} />
				<Text size="sm">
					Não foi possível carregar {what} agora. Tente de novo em alguns
					minutos.
				</Text>
			</Group>
		</Paper>
	);
}
