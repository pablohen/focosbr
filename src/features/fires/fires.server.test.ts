import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DAILY = `id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp
a, -3.200000, -52.210000,2026-10-23 20:40:00,GOES-19,ALTAMIRA,PARÁ,Brasil,1500602,15,33,,,,Amazônia,12.0
`;
const files: Record<string, { body: string; modified: string }> = {
	"focos_diario_br_20261023.csv": {
		body: DAILY,
		modified: "Fri, 23 Oct 2026 21:06:02 GMT",
	},
	// Published before the rewrite: already in the daily file, never fetched.
	"focos_10min_20261023_2100.csv": {
		body: "lat,lon,satelite,data\n -3.200000, -52.210000,GOES-19,2026-10-23 20:40:00\n",
		modified: "Fri, 23 Oct 2026 21:00:02 GMT",
	},
	// After the rewrite: a late VIIRS pass, a point in Venezuela, a repeat.
	"focos_10min_20261023_2110.csv": {
		body: `lat,lon,satelite,data
 -15.600000, -56.100000,NOAA-20,2026-10-23 18:32:00
   9.075100, -62.839300,GOES-19,2026-10-23 20:50:00
 -3.200000, -52.210000,GOES-19,2026-10-23 20:40:00
`,
		modified: "Fri, 23 Oct 2026 21:10:02 GMT",
	},
	"focos_10min_20261023_2120.csv": {
		body: "lat,lon,satelite,data\n -3.210000, -52.220000,GOES-19,2026-10-23 21:00:00\n",
		modified: "Fri, 23 Oct 2026 21:20:02 GMT",
	},
	// 21:30 isn't published yet: 404.
};

describe("getFires", () => {
	const requested: string[] = [];
	beforeEach(() => {
		requested.length = 0;
		vi.stubGlobal("fetch", async (url: string) => {
			const name = url.split("/").at(-1) ?? "";
			requested.push(name);
			const file = files[name];
			return file
				? new Response(file.body, {
						headers: { "last-modified": file.modified },
					})
				: new Response("", { status: 404 });
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it("adds 10-minute files published after the daily rewrite", async () => {
		const { getFires } = await import("./fires.server");
		const res = await getFires(6, new Date(Date.UTC(2026, 9, 23, 21, 31)));

		expect(requested).not.toContain("focos_10min_20261023_2100.csv");
		expect(requested).toContain("focos_10min_20261023_2130.csv");
		// Daily + late VIIRS in MT + 21:00 GOES; Venezuela and the repeat dropped.
		expect(res.fires.t).toHaveLength(3);
		expect(res.fires.prelim).toEqual([1, 0, 1]);
		expect(res.fires.state.map((s) => res.states[s])).toEqual([
			"MT",
			"PA",
			"PA",
		]);
		expect(res.latestAt).toBe("2026-10-23T21:00:00.000Z");
		// The newest file read, not the daily rewrite.
		expect(res.sourceUpdatedAt).toBe("2026-10-23T21:20:02.000Z");
	});
});
