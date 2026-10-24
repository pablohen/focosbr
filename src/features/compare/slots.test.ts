import { describe, expect, it } from "vitest";
import {
	addSlot,
	MAX_PLACES,
	parseSlots,
	removeSlot,
	serializeSlots,
} from "./slots";

describe("parseSlots", () => {
	it("keeps valid keys in place, normalised", () => {
		expect(parseSlots("PA,mt,biome/amazonia")).toEqual([
			"pa",
			"mt",
			"biome/amazonia",
		]);
		expect(parseSlots(",mt")).toEqual([null, "mt"]);
	});

	it("drops bad keys and repeats, caps the count and trims the end", () => {
		expect(parseSlots("xx,pa,pa")).toEqual([null, "pa"]);
		expect(parseSlots("pa,mt,ma,to")).toHaveLength(MAX_PLACES);
		expect(parseSlots("pa,,")).toEqual(["pa"]);
		expect(parseSlots(undefined)).toEqual([]);
	});
});

describe("slot edits", () => {
	it("removing keeps the others' slots, so their colours", () => {
		const slots = removeSlot(["pa", "mt", "ma"], 0);
		expect(slots).toEqual([null, "mt", "ma"]);
		expect(serializeSlots(slots)).toBe(",mt,ma");
		expect(serializeSlots(removeSlot(["pa", "mt"], 1))).toBe("pa");
		expect(serializeSlots(removeSlot(["pa"], 0))).toBeUndefined();
	});

	it("adding fills the first gap, ignores repeats and stops when full", () => {
		expect(addSlot([null, "mt"], "pa")).toEqual(["pa", "mt"]);
		expect(addSlot(["pa"], "mt")).toEqual(["pa", "mt"]);
		expect(addSlot(["pa"], "pa")).toEqual(["pa"]);
		expect(addSlot(["pa", "mt", "ma"], "to")).toEqual(["pa", "mt", "ma"]);
	});
});
