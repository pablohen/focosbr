import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { WindowSchema } from "../fires/schemas";

const hours = WindowSchema.catch(24);

/** Server functions for the region pages; safe to import from routes. */
export const getStateSummary = createServerFn({ method: "GET" })
	.validator(z.object({ state: z.string().max(2), h: hours }))
	.handler(async ({ data }) => {
		const { stateSummary } = await import("./regions.server");
		return stateSummary(data.state, data.h);
	});

export const getMunicipalitySummary = createServerFn({ method: "GET" })
	.validator(
		z.object({ state: z.string().max(2), city: z.string().max(80), h: hours }),
	)
	.handler(async ({ data }) => {
		const { municipalitySummary } = await import("./regions.server");
		return municipalitySummary(data.state, data.city, data.h);
	});

export const getStatesSummary = createServerFn({ method: "GET" })
	.validator(z.object({ h: hours }))
	.handler(async ({ data }) => {
		const { statesSummary } = await import("./regions.server");
		return statesSummary(data.h);
	});
