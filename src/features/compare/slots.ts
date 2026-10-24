/**
 * The compare page's places, as URL slots: `places=pa,mt,biome/amazonia`.
 * A removed place leaves an empty slot (`places=,mt`) so the others keep
 * their colour: colour follows the place, never its position in the list.
 */
import { parseRegionKey, regionKey } from "../places/region-key";

/** Places compared at once: the categorical palette's all-pairs-safe slots. */
export const MAX_PLACES = 3;

export type Slots = (string | null)[];

/** `places` into slots: valid keys, normalised, no repeats, at most MAX_PLACES. */
export function parseSlots(param: string | undefined): Slots {
	const seen = new Set<string>();
	const slots = (param ?? "")
		.split(",")
		.slice(0, MAX_PLACES)
		.map((raw) => {
			const ref = raw ? parseRegionKey(raw) : null;
			const key = ref && regionKey(ref);
			if (!key || seen.has(key)) return null;
			seen.add(key);
			return key;
		});
	return trim(slots);
}

/** Slots back into `places`, or undefined when empty (kept out of the URL). */
export function serializeSlots(slots: Slots): string | undefined {
	const s = trim(slots);
	return s.length ? s.map((k) => k ?? "").join(",") : undefined;
}

/** Adds a place in the first free slot; unchanged if present or full. */
export function addSlot(slots: Slots, key: string): Slots {
	if (slots.includes(key)) return slots;
	const free = slots.indexOf(null);
	if (free >= 0) return slots.map((k, i) => (i === free ? key : k));
	return slots.length < MAX_PLACES ? [...slots, key] : slots;
}

/** Empties a slot, keeping the others where they are. */
export function removeSlot(slots: Slots, index: number): Slots {
	return trim(slots.map((k, i) => (i === index ? null : k)));
}

function trim(slots: Slots): Slots {
	const out = [...slots];
	while (out.length && out.at(-1) === null) out.pop();
	return out;
}
