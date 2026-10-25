/**
 * The site's two table styles, as Mantine Table props, so every table of
 * a kind reads the same.
 */

/** Figures line up in columns. */
export const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/** Lists and rankings on pages: striped, hover, tabular figures. */
export const LIST_TABLE = {
	striped: true,
	highlightOnHover: true,
	fz: "sm",
	style: NUMERIC,
} as const;

/** A chart's table view: dense, small, tabular figures. */
export const COMPACT_TABLE = {
	verticalSpacing: 2,
	horizontalSpacing: 6,
	fz: "xs",
	style: NUMERIC,
} as const;
