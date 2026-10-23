import {
	Anchor,
	type CSSVariablesResolver,
	createTheme,
	type MantineColorsTuple,
} from "@mantine/core";

/** Ember red-orange; shade 8 matches the map's newest-fire colour. */
const ember: MantineColorsTuple = [
	"#fff0ec",
	"#ffded5",
	"#fbbaa8",
	"#f28c5c",
	"#ec6f45",
	"#e45a32",
	"#d9431e",
	"#bc3417",
	"#8f1d0e",
	"#721508",
];

export const theme = createTheme({
	primaryColor: "ember",
	primaryShade: { light: 8, dark: 6 },
	colors: { ember },
	fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
	defaultRadius: "md",
	components: {
		// Links inside text need more than colour to stand out (WCAG 1.4.1).
		Anchor: Anchor.extend({ defaultProps: { underline: "always" } }),
	},
});

/**
 * Mantine's "dimmed" greys miss WCAG AA contrast for body text; these reach
 * 4.5:1 or more.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {},
	light: { "--mantine-color-dimmed": "#5f656d" },
	dark: { "--mantine-color-dimmed": "#9c9c9c" },
});
