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
/**
 * `[west, south, east, north]` in degrees: the part of the map left visible
 * beside (or above) the panel. Brazil never crosses the antimeridian.
 */
export const BBoxSchema = z
	.tuple([
		z.number().min(-180).max(180),
		z.number().min(-90).max(90),
		z.number().min(-180).max(180),
		z.number().min(-90).max(90),
	])
	.refine(
		([w, s, e, n]) => w < e && s < n,
		"expected [west, south, east, north]",
	);
export type BBox = z.infer<typeof BBoxSchema>;

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
	/** "Município (UF)", as INPE's municipality plus its state. */
	municipio: z.string().min(1).max(80).optional().catch(undefined),
	/** Where the user left the map; set only by their own moves. */
	bbox: BBoxSchema.optional().catch(undefined),
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
	/** When INPE last rewrote its files (their Last-Modified), if known. */
	// Fields added after launch have defaults: the CDN can still hold a
	// response from before a deploy, and the new client must accept it.
	sourceUpdatedAt: z.iso.datetime().nullable().default(null),
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
		/**
		 * 1 for a preliminary detection from INPE's 10-minute files: state
		 * located by us, no municipality, biome or FRP yet.
		 */
		prelim: z.array(z.union([z.literal(0), z.literal(1)])).default([]),
		/**
		 * INPE's weather at the spot, null until INPE closes the day: days
		 * without rain, precipitation in mm, fire risk from 0 to 1.
		 */
		dry: z.array(z.number().nullable()).default([]),
		rain: z.array(z.number().nullable()).default([]),
		risk: z.array(z.number().nullable()).default([]),
	}),
});
export type FiresResponse = z.infer<typeof FiresResponseSchema>;
