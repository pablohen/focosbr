import { z } from "zod";
import { SensorSchema, WindowSchema } from "../fires/schemas";
import { STATE_NAMES } from "../fires/states";
import { BRAZIL_ID } from "../history/schemas";
import { biomeHistoryId } from "../places/biomes";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/**
 * The parts of a view a share card shows. The map position is left out: it
 * doesn't change the card, and every distinct URL is a separate CDN entry.
 */
export const CardViewSchema = z.object({
	h: WindowSchema.optional().catch(undefined),
	sensor: z.array(SensorSchema).optional().catch(undefined),
	biome: z.string().min(1).max(40).optional().catch(undefined),
	/** Two-letter state code, upper case. */
	state: z
		.string()
		.regex(/^[A-Z]{2}$/)
		.optional()
		.catch(undefined),
	/** "Altamira (PA)", the city's label in the fire data. */
	city: z.string().min(1).max(80).optional().catch(undefined),
});
export type CardView = z.infer<typeof CardViewSchema>;

/** `/og?…` for a view, in a stable parameter order so equal views share a URL. */
export function cardPath(view: CardView): string {
	const q = new URLSearchParams();
	if (view.h && view.h !== 24) q.set("h", String(view.h));
	if (view.sensor?.length) q.set("sensor", [...view.sensor].sort().join(","));
	if (view.state) q.set("state", view.state);
	if (view.city) q.set("city", view.city);
	if (view.biome) q.set("biome", view.biome);
	const s = q.toString();
	return s ? `/og?${s}` : "/og";
}

/** The `/og` query back into a view (unknown or broken values are dropped). */
export function cardViewFrom(params: URLSearchParams): CardView {
	return CardViewSchema.parse({
		h: Number(params.get("h")) || undefined,
		sensor: params.get("sensor")?.split(",").filter(Boolean),
		state: params.get("state") ?? undefined,
		city: params.get("city") ?? undefined,
		biome: params.get("biome") ?? undefined,
	});
}

/** "Mato Grosso · Cerrado", "Altamira (PA)", or "Brasil". */
export function regionLabel(view: CardView): string {
	const parts = [
		view.city ?? (view.state && (STATE_NAMES[view.state] ?? view.state)),
		view.biome,
	].filter(Boolean);
	return parts.length ? parts.join(" · ") : "Brasil";
}

/**
 * The history `_id` whose year-to-date comparison a card shows: Brazil, a
 * state, a city or a biome alone, with every sensor. Null for anything else
 * (a sensor filter, or a state and a biome together), since history is only
 * kept per region and for the reference satellite.
 */
export function cardHistoryId(
	view: CardView,
	cityId: (label: string) => number | undefined,
	biomeSlug: (name: string) => string | undefined,
): string | null {
	if (view.sensor?.length) return null;
	const { state, city, biome } = view;
	if (city) {
		if (biome) return null;
		const id = cityId(city);
		return id === undefined ? null : String(id);
	}
	if (state && biome) return null;
	if (state) return state;
	if (biome) {
		const slug = biomeSlug(biome);
		return slug ? biomeHistoryId(slug) : null;
	}
	return BRAZIL_ID;
}
