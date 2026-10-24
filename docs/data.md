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

| INPE column             | Used as                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `lat`, `lon`            | Position (leading spaces are normal).                                                                         |
| `data_hora_gmt`         | Detection time, UTC (`2026-10-23 20:40:00`).                                                                  |
| `satelite`              | Satellite name, grouped into sensor families by `sensorOf`.                                                   |
| `municipio`             | Municipality, title-cased (`SÃO JOSÉ DO RIBAMAR` → `São José do Ribamar`).                                    |
| `estado_id`             | IBGE state code → two-letter UF (`22` → `PI`).                                                                |
| `bioma`                 | Biome, verbatim (`Amazônia`, `Cerrado`, `Caatinga`, `Mata Atlântica`, `Pantanal`, `Pampa`).                   |
| `frp`                   | Fire radiative power in MW; empty for some sensors (→ `null`).                                                |
| `numero_dias_sem_chuva` | Days without rain at the spot.                                                                                |
| `precipitacao`          | Precipitation, mm.                                                                                            |
| `risco_fogo`            | Fire risk, 0–1, shown with INPE's classes: Mínimo < 0.15 ≤ Baixo < 0.4 ≤ Médio < 0.7 ≤ Alto < 0.95 ≤ Crítico. |

**The three weather columns are empty in today's file.** INPE fills them when it closes the day (the next morning's rewrite), so they show up for yesterday's detections in the 24 h and 48 h windows. `-999` and blanks become `null` (`optionalNumber`). On 2026-10-22, all 28,869 detections had them; on the same evening, none of 2026-10-23's did.

Ignored for now: `id`, `estado`, `pais*`, `municipio_id`.

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
- **Hourly counts** (`hourlyCounts`): detections per clock hour, ending with the current hour. Peaks follow satellite passes (VIIRS early afternoon local time), so the shape mixes fire activity with when the satellites looked.
- **Freshness** (`freshness`): minutes since `sourceUpdatedAt`; stale past 120.

## Static data

`public/data/state-outlines.geojson`: IBGE state boundaries, simplified, generated by GeoparqueBR's `pnpm geo:places`. The map draws the selected state from it, and the server locates preliminary detections with it (bundled via `?raw`). Copy it again from GeoparqueBR when IBGE publishes a new edition.
