import { Box } from "@mantine/core";
import { AGE_BANDS } from "~/features/fires/view";

export type RegionMapData = {
	width: number;
	height: number;
	/** Other states' outlines in the frame, as one SVG path. */
	states: string;
	/** The page's state outline. */
	selected: string;
	/** Other detections in the state (on a city page), as a dots path. */
	context: string;
	/** All of the region's detections, for the rings under the dots. */
	all: string;
	/** The region's detections by age band, oldest band first. */
	bands: string[];
};

const DOT = 6;

/**
 * A static map of the region, drawn on the server from INPE's detections:
 * state outlines and age-coloured dots (paths of round-capped zero-length
 * segments, see `dotsPath`). Theme colours come from CSS variables, so it
 * follows light and dark mode; the dot colours are the map's validated age
 * ramp.
 */
export function RegionMap({
	map,
	label,
}: {
	map: RegionMapData;
	label: string;
}) {
	// Bands arrive oldest first; AGE_BANDS lists newest first.
	const colors = [...AGE_BANDS].reverse().map((b) => b.color);
	return (
		<Box
			component="svg"
			viewBox={`0 0 ${map.width} ${map.height}`}
			role="img"
			aria-label={label}
			w="100%"
			h="auto"
			style={{
				display: "block",
				background: "var(--mantine-color-default)",
				borderRadius: "var(--mantine-radius-md)",
				border: "1px solid var(--mantine-color-default-border)",
			}}
		>
			<path
				d={map.states}
				fill="none"
				stroke="var(--mantine-color-default-border)"
				strokeWidth={1}
			/>
			<path
				d={map.selected}
				fill="var(--mantine-color-default-hover)"
				stroke="var(--mantine-color-dimmed)"
				strokeWidth={1.5}
			/>
			<path
				d={map.context}
				stroke="var(--mantine-color-dimmed)"
				strokeOpacity={0.35}
				strokeWidth={4}
				strokeLinecap="round"
			/>
			{/* A ring in the page colour separates overlapping dots. */}
			<path
				d={map.all}
				stroke="var(--mantine-color-body)"
				strokeWidth={DOT + 1.5}
				strokeLinecap="round"
			/>
			{map.bands.map((d, k) => (
				<path
					key={colors[k]}
					d={d}
					stroke={colors[k]}
					strokeWidth={DOT}
					strokeLinecap="round"
				/>
			))}
		</Box>
	);
}
