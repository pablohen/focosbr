# Data

## Source: INPE Programa Queimadas

- **Daily Brazil files:** `https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_YYYYMMDD.csv`, one per **UTC** day.
- **Update cadence:** today's file is rewritten through the day, but not on a fixed schedule; gaps of 50+ minutes between rewrites happen. The newest detection is usually 30–60 minutes behind real time. Right after 00:00 UTC, today's file doesn't exist yet (404 → treated as empty).
- **Licence/credit:** public data from INPE; credit "INPE, Programa Queimadas" (shown in the panel and the map attribution).
- **No key, no rate limit we know of.** The caches in [architecture](architecture.md) keep us at a few requests per instance per 5 minutes.

### 10-minute files

- `https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/focos_10min_YYYYMMDD_HHMM.csv`, named by **UTC publish time**, one every 10 minutes, kept for a few days.
- Columns: `lat,lon,satelite,data` only, covering **South America**. There's no state, municipality, biome or FRP.
- A file holds whatever INPE processed in those 10 minutes. That's usually the last GOES scans, but sometimes a whole VIIRS pass from hours earlier. For example, the 21:10 file on 2026-10-23 held 1,158 detections from 18:32–18:43.
- **How we use them:** `gapSlots(cutoff, now)` lists the files published after the current day's daily rewrite (at most 36, so 6 hours). `parseTenMinuteCsv` keeps the points `locate.ts` places in a Brazilian state, and `mergeDetections` adds the ones the daily file doesn't have. Checked against INPE: files published before a rewrite are already in the daily file, and files after it aren't.
- **State lookup:** point-in-polygon over the IBGE outlines. On a day of daily-file detections, it matched INPE's state for 26,305 of 26,336 (99.9%). 30 near borders differ, and 1 fell outside the simplified coastline and would be dropped.

### Columns used

Columns are looked up **by header name**; a renamed or missing column makes the parser throw instead of silently shifting fields.

| INPE column                 | Used as                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lat`, `lon`                | Position (leading spaces are normal).                                                                                                                  |
| `data_hora_gmt`             | Detection time, UTC (`2026-10-23 20:40:00`).                                                                                                           |
| `satelite`                  | Satellite name, grouped into sensor families by `sensorOf`.                                                                                            |
| `municipio`, `municipio_id` | Municipality: IBGE's official name for the code (`SÃO LUIZ` → São Luiz do Anauá, `D'OESTE` → D'Oeste); INPE's name title-cased if the code is unknown. |
| `estado_id`                 | IBGE state code → two-letter UF (`22` → `PI`).                                                                                                         |
| `bioma`                     | Biome, verbatim (`Amazônia`, `Cerrado`, `Caatinga`, `Mata Atlântica`, `Pantanal`, `Pampa`).                                                            |
| `frp`                       | Fire radiative power in MW; empty for some sensors (→ `null`).                                                                                         |
| `numero_dias_sem_chuva`     | Days without rain at the spot.                                                                                                                         |
| `precipitacao`              | Precipitation, mm.                                                                                                                                     |
| `risco_fogo`                | Fire risk, 0–1, shown with INPE's classes: Mínimo < 0.15 ≤ Baixo < 0.4 ≤ Médio < 0.7 ≤ Alto < 0.95 ≤ Crítico.                                          |

**The three weather columns are empty in today's file.** INPE fills them when it closes the day (the next morning's rewrite), so they show up for yesterday's detections in the 24 h and 48 h windows. `-999` and blanks become `null` (`optionalNumber`). On 2026-10-22, all 28,869 detections had them; on the same evening, none of 2026-10-23's did.

Ignored for now: `id`, `estado`, `pais*`.

### Sensor families

| Family | INPE names                                  | Notes                                                          |
| ------ | ------------------------------------------- | -------------------------------------------------------------- |
| VIIRS  | `NPP-375`, `NPP-375D`, `NOAA-20`, `NOAA-21` | 375 m, most detail, a few passes a day.                        |
| MODIS  | `TERRA_M-*`, `AQUA_M-*`                     | 1 km. AQUA afternoon is INPE's historical reference satellite. |
| GOES   | `GOES-*`                                    | Geostationary, every 10 min, ~2 km, less precise.              |
| METOP  | `METOP-*`                                   | AVHRR.                                                         |
| MSG    | `MSG-*`                                     | Geostationary (Europe), edge of view.                          |

## API payload

`GET /api/fires?h=6|24|48` → `FiresResponseSchema` (`src/features/fires/schemas.ts`):

```jsonc
{
  "generatedAt": "2026-10-23T21:57:47.509Z",
  "hours": 24,
  "latestAt": "2026-10-23T20:40:00.000Z",      // newest detection in the window
  "sourceUpdatedAt": "2026-10-23T21:06:02.000Z", // newest Last-Modified read (daily or 10-minute)
  "satellites": ["GOES-19", "NOAA-20", …],     // lookup tables
  "states": ["PI", "MA", …],
  "places": ["Corrente (PI)", …],
  "biomes": ["Cerrado", …],
  "fires": {                                   // one array per field, same index
    "lon": [-45.0006, …], "lat": [-10.6019, …],
    "t": [1792713600, …],                      // Unix seconds, UTC
    "frp": [70.9, null, …],
    "sat": [0, …], "state": [0, …], "place": [0, …], "biome": [0, …],
    "prelim": [0, …, 1],                       // 1 = from a 10-minute file
    "dry": [22, null, …], "rain": [0, null, …], "risk": [0.98, null, …] // null until INPE closes the day
  }
}
```

Detections are sorted oldest first, so the newest draw on top. The columnar shape keeps 24 h (~28k detections) to a few MB before gzip, instead of several times that as objects.

## Derived numbers

- **Estimated fires** (`estimateFires`): detections within **2 km** and **1 hour** of each other are joined with union-find over a 0.02° grid, transitively, so a front that keeps burning stays one fire. On a typical day, 28.5k detections come down to about 6.7k fires. It's an estimate: big fronts can merge, and nearby separate fires can join.
- **A detection's fire** (`fireGroups`, `describeGroup`): the same grouping, kept per detection. The popup shows how many detections the fire has, its first and last time and which satellites saw it.
- **Biggest fires** (`topFires`): fires ranked by detection count, which reflects extent and duration (GOES sees a long fire every 10 minutes), or by total FRP, which reflects intensity. Neither is burned area, and the panel says so.
- **Hourly counts** (`hourlyCounts`): detections per clock hour, ending with the current hour. Peaks follow satellite passes (VIIRS early afternoon local time), so the shape mixes fire activity with when the satellites looked.
- **Freshness** (`freshness`): minutes since `sourceUpdatedAt`; stale past 120.

## History (MongoDB)

The state and city pages (and `/states`, for Brazil) show this year so far against the same period of every year since 2003, a fire-season calendar (month × year), detections per year, per month for the last 24 months and per day for the last 90 days; `/rankings` ranks states and cities by this year so far. They read it from MongoDB (`history` collection, one document per region), which `pnpm history:build` fills:

| Series                     | Source                                                                                                                    | Satellites                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Months (and years, summed) | yearly files `anual/Brasil_sat_ref/focos_br_ref_YYYY.zip` (2003 → last year), then the monthly files for the current year | **reference only** (AQUA, afternoon pass), comparable across years |
| Reference days (`refDays`) | the same files as months, by day                                                                                          | **reference only**; for the year-to-date comparison                |
| Days                       | monthly files `mensal/Brasil/focos_mensal_br_YYYYMM.csv` (since 2023), then the daily files for the last 31 days          | all                                                                |
- The yearly files carry **names, not IBGE codes**: states match by name (100%), municipalities by name with a small rename table (`RENAMED` in `build.ts`), 99.86%. The rest count for their state only. Monthly and daily files carry codes.
- Days and months are in **Brasília time** (UTC−3).
- **Summaries** (`summaries` collection): `week` (the last 7 closed days: all satellites against the week before, reference satellite against the same month-days since 2003, for Brazil, states, biomes and the top and fastest-rising cities) and `year/<y>` (every year since 2003: Brazil's months and totals, states, biomes and top cities).
- **Fire-risk forecast** (`forecast` collection, `scripts/forecast.ts`): INPE's `riscofogo_meteorologia/previsto/risco_fogo/RF.PREV.T0…T3.tif` (WGS 84, 0.01°, −999 no data, values 0–1; T0 is the issue day). Sampled on grids inside each state (our outlines), city (IBGE's mesh, committed as `data/municipal-mesh.json.gz` by `pnpm geo:centroids`, since IBGE's server doesn't answer GitHub's runners) and Brazil; stored as the mean and the share at high or critical risk (≥ 0.7) per day.
- **Centroids** (`places/centroids.json`, `pnpm geo:centroids`): area-weighted centroids of IBGE's municipal mesh, for the state pages' city circles.
- **Alerts** (`alerts.ts`, after the `ytd` refresh): a city, state or biome at double its average for the year so far (average at least 50), once per year; and a record day (yesterday above every earlier day since 2003, at least 10) for states, biomes and Brazil. Stored in `alerts` once; served by `/alerts`, `/feed.xml` and `/api/alerts`.
- **Open API**: `/api/history/<key>` returns a region's `RegionHistory` with attribution, CORS-open, cached an hour.
- **Biomes** come from INPE's `bioma` column (every file has it; the six names are consistent since 2003) and get documents `biome/<slug>`. Detections with an empty biome (offshore, border, preliminary) count for no biome.
- **Downloads** (`history/export.ts`): years, every month since 2003, the same period year by year, the season's running totals and the last 90 days, as CSV with the map export's encoder (`csvTable`).
- **Share cards** add the stored `ytd` for one region with every sensor (`cardHistoryId`).
- **Year to date** (`ytdSummary`) compares 1 January → yesterday (the last closed day) with the same month-day in every year since 2003, from `refDays`. The script stores it on every document as `ytd` (`through`, `current`, `average`, `ratio`, `record`, `years`), indexed by `kind` + `ytd.current` and `kind` + `ytd.ratio`, so `/rankings` is three indexed queries. The "above their own average" ranking only takes cities averaging at least `RANKING_MIN_AVERAGE` (50) detections in the period.
- The **season tracker** (`seasonCurve`) samples running totals from 1 January every 7th day of the year (and 31 December), cut by month-day so years line up: this year up to yesterday, and the past years' min, max, average and record year.
- The **rankings map** bins each state's ratio to its average (`anomalyStep`): under 0.5, under 0.8, 0.8–1.25 (about average), up to 2, over 2, symmetric in ratio terms.
- The **calendar** colours each month on a square-root scale of the region's busiest month (`calendarStep`), with an ordinal one-hue ramp (`--cal-1…5` in `app.css`, validated separately for light and dark) and a neutral `--cal-0` for none.
- A run _sets_ the months and days it processed, so re-running is safe. The daily run (GitHub Actions, 12:30 UTC) covers this month, last month and the last 31 days. `--backfill` covers everything (about 6 million detections in 2003–2025, plus the monthly files since 2023; a few minutes). Completed files are cached in `.cache/history`.

## Downloads

`export.ts` turns the detections on screen (window and filters) into rows. Column names follow INPE's where it has one:

`id_fogo` (same id = same estimated fire), `data_hora_utc`, `data_hora_brasilia`, `latitude`, `longitude`, `satelite`, `sensor`, `municipio`, `uf`, `bioma`, `frp_mw`, `dias_sem_chuva`, `precipitacao_mm`, `risco_fogo`, `preliminar` (1 = from a 10-minute file).
- **CSV:** RFC 4180 quoting, a dot as the decimal separator, a UTF-8 BOM so spreadsheet apps read the accents, CRLF line ends. Missing values are empty fields, never `0`.
- **GeoJSON:** points as `[longitude, latitude]`, the other columns as properties, and a top-level `attribution` crediting INPE.
- **File names:** `focos-<region>-<window>h-<YYYYMMDD-HHMM>.<ext>`, with the time in Brasília, e.g. `focos-mt-24h-20261024-1136.csv`.

## Municipalities

`src/features/places/municipalities.json`: every municipality's IBGE code and official name, by state (`pnpm geo:municipalities`, from IBGE's localidades API; ~140 KB, server only). It names the detections, resolves `/states/<state>/<city>` slugs (unique within a state) and lists the city pages in the sitemap. On 2026-10-23, 1,183 of the 1,185 municipalities with fires already matched INPE's name by slug; the 2 that didn't were renames, which the code match fixes.

## Static data

`public/data/state-outlines.geojson`: IBGE state boundaries, simplified, generated by GeoparqueBR's `pnpm geo:places`. The map draws the selected state from it, and the server locates preliminary detections with it (bundled via `?raw`). Copy it again from GeoparqueBR when IBGE publishes a new edition.
