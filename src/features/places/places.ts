/**
 * Region pages' names, slugs and paths. Pure and small, so both the server
 * and the browser use it; the municipality list itself (places.server.ts)
 * stays on the server.
 */
import { z } from "zod";
import { STATE_NAMES } from "../fires/states";

/** ASCII slug: "São Félix do Xingu" → "sao-felix-do-xingu". */
export function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export const isState = (uf: string): boolean => uf in STATE_NAMES;

/** "Altamira (PA)": the label detections and the `municipio` filter use. */
export const placeLabel = (name: string, uf: string) => `${name} (${uf})`;

/** "Altamira (PA)" → { name: "Altamira", uf: "PA" }; null for anything else. */
export function splitPlaceLabel(
	label: string,
): { name: string; uf: string } | null {
	const m = /^(.+) \(([A-Z]{2})\)$/.exec(label);
	return m?.[1] && m[2] ? { name: m[1], uf: m[2] } : null;
}

export const statePath = (uf: string) => `/estados/${uf.toLowerCase()}`;
export const municipalityPath = (uf: string, name: string) =>
	`/municipios/${uf.toLowerCase()}/${slugify(name)}`;

export type Municipality = { id: number; name: string; uf: string };

/** `{ "PA": [[1500602, "Altamira"], …] }`, as scripts/municipalities.ts writes it. */
export const MunicipalityListSchema = z.record(
	z.string().regex(/^[A-Z]{2}$/),
	z.array(z.tuple([z.number().int(), z.string().min(1)])),
);
export type MunicipalityList = z.infer<typeof MunicipalityListSchema>;

/** Lookups over the IBGE list: by code (for INPE rows) and by state + slug (for URLs). */
export function municipalityIndex(list: MunicipalityList) {
	const byId = new Map<number, Municipality>();
	const bySlug = new Map<string, Municipality>();
	for (const [uf, rows] of Object.entries(list))
		for (const [id, name] of rows) {
			const m = { id, name, uf };
			byId.set(id, m);
			bySlug.set(`${uf}/${slugify(name)}`, m);
		}
	return {
		byId,
		find: (uf: string, slug: string) =>
			bySlug.get(`${uf.toUpperCase()}/${slug}`),
		all: () => [...byId.values()],
	};
}
