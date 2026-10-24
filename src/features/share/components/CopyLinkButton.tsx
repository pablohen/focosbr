import { ActionIcon, Tooltip } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { CheckIcon, LinkIcon } from "@phosphor-icons/react";

/**
 * Copies the page's URL, which carries the whole view: window, filters and
 * map position. Read at click time, since panning rewrites the URL.
 */
export function CopyLinkButton() {
	const clipboard = useClipboard({ timeout: 2000 });
	const label = clipboard.copied ? "Link copiado" : "Copiar link desta visão";
	return (
		<Tooltip label={label} withArrow>
			<ActionIcon
				variant="default"
				size="lg"
				onClick={() => clipboard.copy(window.location.href)}
				aria-label={label}
				color={clipboard.copied ? "teal" : undefined}
			>
				{clipboard.copied ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
			</ActionIcon>
		</Tooltip>
	);
}
