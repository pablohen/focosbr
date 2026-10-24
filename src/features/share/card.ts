import type { FiresSearch } from "../fires/schemas";
import { STATE_NAMES } from "../fires/states";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** The parts of the view a card shows. The map position is left out: it
 * doesn't change the card, and every distinct URL is a separate CDN entry. */
export type CardView = Pick<
	FiresSearch,
	"h" | "sensor" | "uf" | "bioma" | "municipio"
>;

/** `/og?…` for a view, in a stable parameter order so equal views share a URL. */
export function cardPath(view: CardView): string {
	const q = new URLSearchParams();
	if (view.h && view.h !== 24) q.set("h", String(view.h));
	if (view.sensor?.length) q.set("sensor", [...view.sensor].sort().join(","));
	if (view.uf) q.set("uf", view.uf);
	if (view.bioma) q.set("bioma", view.bioma);
	if (view.municipio) q.set("municipio", view.municipio);
	const s = q.toString();
	return s ? `/og?${s}` : "/og";
}

/** The `/og` query back into a view (unknown or broken values are dropped). */
export function cardViewFrom(params: URLSearchParams): Record<string, unknown> {
	const h = Number(params.get("h"));
	return {
		h: h || undefined,
		sensor: params.get("sensor")?.split(",").filter(Boolean),
		uf: params.get("uf") ?? undefined,
		bioma: params.get("bioma") ?? undefined,
		municipio: params.get("municipio") ?? undefined,
	};
}

/** "Mato Grosso · Cerrado", "Altamira (PA)", or "Brasil". */
export function regionLabel(view: CardView): string {
	const parts = [
		view.municipio ?? (view.uf && (STATE_NAMES[view.uf] ?? view.uf)),
		view.bioma,
	].filter(Boolean);
	return parts.length ? parts.join(" · ") : "Brasil";
}
