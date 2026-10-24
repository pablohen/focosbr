import { Button, Group, Text } from "@mantine/core";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { exportFileName, exportRows, toCsv, toGeoJson } from "../export";
import type { FiresResponse } from "../schemas";
import type { FireGroups } from "../view";

function save(text: string, type: string, name: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

/** Downloads the detections on screen (current window and filters). */
export function Download({
	data,
	indices,
	groups,
	region,
}: {
	data: FiresResponse;
	indices: number[];
	groups: FireGroups;
	region: { uf?: string; biome?: string; place?: string };
}) {
	const download = (ext: "csv" | "geojson") => {
		const rows = exportRows(data, indices, groups);
		const name = exportFileName(ext, region, data.hours, new Date());
		if (ext === "csv") save(toCsv(rows), "text/csv;charset=utf-8", name);
		else save(JSON.stringify(toGeoJson(rows)), "application/geo+json", name);
	};
	return (
		<Group gap="xs" wrap="nowrap">
			<Text size="sm" fw={600} style={{ flex: 1 }}>
				{indices.length === 1
					? "Baixar o foco filtrado"
					: "Baixar os focos filtrados"}
			</Text>
			<Button
				size="compact-xs"
				variant="default"
				leftSection={<DownloadSimpleIcon size={14} />}
				disabled={indices.length === 0}
				onClick={() => download("csv")}
			>
				CSV
			</Button>
			<Button
				size="compact-xs"
				variant="default"
				leftSection={<DownloadSimpleIcon size={14} />}
				disabled={indices.length === 0}
				onClick={() => download("geojson")}
			>
				GeoJSON
			</Button>
		</Group>
	);
}
