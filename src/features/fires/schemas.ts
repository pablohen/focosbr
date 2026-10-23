import { z } from "zod";

/** Look-back windows, in hours, the map offers. */
export const WINDOWS = [6, 24, 48] as const;
export const WindowSchema = z.union(WINDOWS.map((h) => z.literal(h)));
export type Window = z.infer<typeof WindowSchema>;

/** Sensor families, grouped from INPE's satellite names (`sensorOf`). */
export const SENSORS = [
	"viirs",
	"modis",
	"goes",
	"metop",
	"msg",
	"other",
] as const;
export const SensorSchema = z.enum(SENSORS);
export type Sensor = z.infer<typeof SensorSchema>;

/** The map page's URL state. A missing or invalid value falls back silently. */
export const FiresSearchSchema = z.object({
	h: WindowSchema.optional().catch(undefined),
	sensor: z.array(SensorSchema).optional().catch(undefined),
	/** Two-letter state code. */
	uf: z
		.string()
		.regex(/^[A-Z]{2}$/)
		.optional()
		.catch(undefined),
	/** Biome name as INPE publishes it ("Amazônia", "Cerrado"…). */
	bioma: z.string().min(1).max(40).optional().catch(undefined),
});
export type FiresSearch = z.infer<typeof FiresSearchSchema>;

/**
 * `/api/fires` payload. Detections are columnar (one array per field, same
 * index) with repeated strings moved to lookup tables: a day is ~25k rows,
 * and an array of objects would be several times larger.
 */
export const FiresResponseSchema = z.object({
	generatedAt: z.iso.datetime(),
	hours: WindowSchema,
	/** Newest detection in the window, if any. */
	latestAt: z.iso.datetime().nullable(),
	satellites: z.array(z.string()),
	/** Two-letter state codes. */
	states: z.array(z.string()),
	/** "Município (UF)" labels. */
	places: z.array(z.string()),
	biomes: z.array(z.string()),
	fires: z.object({
		lon: z.array(z.number()),
		lat: z.array(z.number()),
		/** Detection time, Unix seconds. */
		t: z.array(z.number()),
		/** Fire radiative power in MW; INPE leaves it empty for some sensors. */
		frp: z.array(z.number().nullable()),
		sat: z.array(z.number().int()),
		state: z.array(z.number().int()),
		place: z.array(z.number().int()),
		biome: z.array(z.number().int()),
	}),
});
export type FiresResponse = z.infer<typeof FiresResponseSchema>;
