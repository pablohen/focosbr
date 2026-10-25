import { MantineProvider } from "@mantine/core";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Freshness } from "./Freshness";

const render = (props: Parameters<typeof Freshness>[0]) =>
	renderToString(
		createElement(MantineProvider, null, createElement(Freshness, props)),
	);

describe("Freshness", () => {
	afterEach(() => vi.useRealTimers());

	// Regression: the server and the browser rendered "há 4 min" and
	// "há 5 min" across a minute boundary, failing hydration.
	it("renders the same first frame at any clock when given renderedAt", () => {
		const props = {
			sourceUpdatedAt: "2026-10-25T15:30:00Z",
			renderedAt: "2026-10-25T15:34:30Z",
		};
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-25T15:34:30Z"));
		const server = render(props);
		vi.setSystemTime(new Date("2026-10-25T15:35:10Z"));
		const client = render(props);
		expect(client).toBe(server);
		expect(server).toContain("há 4 min");
	});
});
