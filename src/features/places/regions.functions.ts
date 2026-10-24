import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { WindowSchema } from "../fires/schemas";

const hours = WindowSchema.catch(24);

/** Server functions for the region pages; safe to import from routes. */
export const getStateDetails = createServerFn({ method: "GET" })
	.validator(z.object({ state: z.string().max(2), h: hours }))
	.handler(async ({ data }) => {
		const { stateDetails } = await import("./regions.server");
		return stateDetails(data.state, data.h);
	});

export const getCityDetails = createServerFn({ method: "GET" })
	.validator(
		z.object({ state: z.string().max(2), city: z.string().max(80), h: hours }),
	)
	.handler(async ({ data }) => {
		const { cityDetails } = await import("./regions.server");
		return cityDetails(data.state, data.city, data.h);
	});

export const getStatesSummary = createServerFn({ method: "GET" })
	.validator(z.object({ h: hours }))
	.handler(async ({ data }) => {
		const { statesSummary } = await import("./regions.server");
		return statesSummary(data.h);
	});

export const getBiomeDetails = createServerFn({ method: "GET" })
	.validator(z.object({ biome: z.string().max(40), h: hours }))
	.handler(async ({ data }) => {
		const { biomeDetails } = await import("./regions.server");
		return biomeDetails(data.biome, data.h);
	});

export const getBiomesSummary = createServerFn({ method: "GET" })
	.validator(z.object({ h: hours }))
	.handler(async ({ data }) => {
		const { biomesSummary } = await import("./regions.server");
		return biomesSummary(data.h);
	});

export const getEmbed = createServerFn({ method: "GET" })
	.validator(
		z.object({
			state: z.string().max(2).optional(),
			city: z.string().max(80).optional(),
			biome: z.string().max(40).optional(),
			h: hours,
		}),
	)
	.handler(async ({ data }) => {
		const { embedDetails } = await import("./regions.server");
		return embedDetails(data, data.h);
	});
