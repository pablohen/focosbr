import { Button, Code, CopyButton, Popover, Stack, Text } from "@mantine/core";
import { CodeIcon } from "@phosphor-icons/react";
import { embedCode } from "./EmbedCard";

/** Shows and copies the iframe code for a region's widget. */
export function EmbedButton({
	embedPath,
	name,
}: {
	/** "/embed/states/pa". */
	embedPath: string;
	name: string;
}) {
	const code = embedCode(embedPath, name);
	return (
		<Popover width={320} position="bottom-end" withArrow shadow="md">
			<Popover.Target>
				<Button
					size="xs"
					variant="default"
					leftSection={<CodeIcon size={16} />}
				>
					Incorporar
				</Button>
			</Popover.Target>
			<Popover.Dropdown>
				<Stack gap="xs">
					<Text size="sm">
						Cole este código no seu site para mostrar os números e a temporada
						de queimadas de {name}, atualizados com os dados do INPE.
					</Text>
					<Code
						block
						style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
					>
						{code}
					</Code>
					<CopyButton value={code}>
						{({ copied, copy }) => (
							<Button
								size="xs"
								onClick={copy}
								color={copied ? "teal" : undefined}
							>
								{copied ? "Código copiado" : "Copiar código"}
							</Button>
						)}
					</CopyButton>
				</Stack>
			</Popover.Dropdown>
		</Popover>
	);
}
