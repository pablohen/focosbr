import { STATE_NAMES } from "~/features/fires/states";
import { municipalities } from "~/features/places/places.server";
import {
	BRAZIL,
	type Outlines,
	outlinePath,
	projector,
} from "~/features/share/card-map";
import { getDb } from "~/lib/db.server";
import outlinesText from "../../../public/data/state-outlines.geojson?raw";
import {
	BRAZIL_ID,
	FIRST_YEAR,
	HISTORY_COLLECTION,
	RANKING_MAP,
	RANKING_MIN_AVERAGE,
	RANKING_SIZE,
	type RankingRow,
	type Rankings,
} from "./schemas";

type Doc = {
	_id: string;
	ytd?: {
		through?: string;
		current: number;
		average: number;
		ratio: number | null;
	};
};

let shapes: { uf: string; path: string }[] | undefined;

/** Every state's outline as an SVG path, projected for the rankings map (once per instance). */
function stateShapes() {
	if (shapes) return shapes;
	const outlines = JSON.parse(outlinesText) as Outlines;
	const project = projector(BRAZIL, RANKING_MAP.width, RANKING_MAP.height);
	shapes = outlines.features.map((f) => ({
		uf: f.properties.uf,
		path: outlinePath(outlines, project, (uf) => uf === f.properties.uf, 1),
	}));
	return shapes;
}

const YTD = { "ytd.current": 1, "ytd.average": 1, "ytd.ratio": 1 } as const;

/**
 * This year to date by state and by city, from the `ytd` summaries the
 * history script stores (sorted by the collection's ytd indexes), or null
 * when the database can't be reached. Cities are named from IBGE's list.
 */
export async function loadRankings(): Promise<Rankings | null> {
	try {
		const history = (await getDb()).collection<Doc>(HISTORY_COLLECTION);
		const brazil = await history.findOne(
			{ _id: BRAZIL_ID },
			{ projection: { "ytd.through": 1 } },
		);
		const through = brazil?.ytd?.through;
		if (!through) return null;
		const [states, cities, aboveAverage] = await Promise.all([
			history
				.find({ kind: "state" }, { projection: YTD })
				.sort({ "ytd.current": -1 })
				.toArray(),
			history
				.find({ kind: "city", "ytd.current": { $gt: 0 } }, { projection: YTD })
				.sort({ "ytd.current": -1 })
				.limit(RANKING_SIZE)
				.toArray(),
			history
				.find(
					{
						kind: "city",
						"ytd.average": { $gte: RANKING_MIN_AVERAGE },
						"ytd.ratio": { $gt: 1 },
					},
					{ projection: YTD },
				)
				.sort({ "ytd.ratio": -1 })
				.limit(RANKING_SIZE)
				.toArray(),
		]);
		return {
			through,
			firstYear: FIRST_YEAR,
			states: states.flatMap((d) => row(d, "state")),
			cities: cities.flatMap((d) => row(d, "city")),
			aboveAverage: aboveAverage.flatMap((d) => row(d, "city")),
			map: { ...RANKING_MAP, states: stateShapes() },
		};
	} catch (err) {
		console.warn("rankings unavailable:", String(err));
		return null;
	}
}

/** A ranking row, or none for an unknown code or a document without a summary. */
function row(doc: Doc, kind: "state" | "city"): RankingRow[] {
	if (!doc.ytd) return [];
	const { current, average, ratio } = doc.ytd;
	if (kind === "state") {
		const name = STATE_NAMES[doc._id];
		return name ? [{ uf: doc._id, name, current, average, ratio }] : [];
	}
	const city = municipalities.byId.get(Number(doc._id));
	return city
		? [{ uf: city.uf, name: city.name, current, average, ratio }]
		: [];
}
