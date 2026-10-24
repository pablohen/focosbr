import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_PLACES } from "./slots";

/** Server functions for /compare; safe to import from routes. */
export const getCompare = createServerFn({ method: "GET" })
	.validator(
		z.object({ slots: z.array(z.string().max(90).nullable()).max(MAX_PLACES) }),
	)
	.handler(async ({ data }) => {
		const { compareRegions } = await import("./compare.server");
		return compareRegions(data.slots);
	});
