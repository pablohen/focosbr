import { z } from "zod";

/** /compare's URL state: the places (see slots.ts) and the chart's scale. */
export const CompareSearchSchema = z.object({
	places: z.string().max(200).optional().catch(undefined),
	/** "index": each place as a % of its own average year. Default: counts. */
	scale: z.enum(["index"]).optional().catch(undefined),
});
export type CompareSearch = z.infer<typeof CompareSearchSchema>;
