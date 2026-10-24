import list from "./municipalities.json";
import { MunicipalityListSchema, municipalityIndex } from "./places";

/** IBGE's municipalities, validated and indexed once per instance (server only: ~140 KB). */
export const municipalities = municipalityIndex(
	MunicipalityListSchema.parse(list),
);
