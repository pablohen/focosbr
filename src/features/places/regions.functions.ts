import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { WindowSchema } from "../fires/schemas";

const hours = WindowSchema.catch(24);

/** Server functions for the region pages; safe to import from routes. */
export const getStateSummary = createServerFn({ method: "GET" })
	.validator(z.object({ uf: z.string().max(2), h: hours }))
	.handler(async ({ data }) => {
		const { stateSummary } = await import("./regions.server");
		return stateSummary(data.uf, data.h);
	});

export const getMunicipalitySummary = createServerFn({ method: "GET" })
	.validator(
		z.object({ uf: z.string().max(2), slug: z.string().max(80), h: hours }),
	)
	.handler(async ({ data }) => {
		const { municipalitySummary } = await import("./regions.server");
		return municipalitySummary(data.uf, data.slug, data.h);
	});

export const getStatesSummary = createServerFn({ method: "GET" })
	.validator(z.object({ h: hours }))
	.handler(async ({ data }) => {
		const { statesSummary } = await import("./regions.server");
		return statesSummary(data.h);
	});
