# Architecture

FocosBR is a single page over a single API route. No database, no cron, no secrets.

```
INPE daily files ─────────┐
INPE 10-minute files ─────┤ (only those published after the daily rewrite)
                          ▼
                     /api/fires (Nitro function, gru1)
                            │  parse, locate state (locate.ts), merge, window, pack (inpe.ts)
                            │  per-instance cache (fires.server.ts)
                            ▼
                     Vercel CDN (s-maxage=300)
                            │  columnar JSON
                            ▼
                    Browser (routes/index.tsx)
                            │  useFires (TanStack Query): fetch, validate, cache per window, refetch
                            │  view.ts: filter → count → merge → bucket
                            ├──▶ FirePanel (counts, chart, filters)
                            └──▶ FireMap  (MapLibre, clusters, popups)
```

## Files

| Path                                               | Role                                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/fires/schemas.ts`                    | Zod schemas: API payload and URL search params.                                                                                                                                                                                 |
| `src/features/fires/inpe.ts`                       | Pure: INPE CSV parsing, day/window maths, `buildFiresResponse` (columnar packing).                                                                                                                                              |
| `src/features/fires/locate.ts`                     | Pure: point-in-state lookup over the IBGE outlines, for 10-minute detections.                                                                                                                                                   |
| `src/features/fires/fires.server.ts`               | Server-only: fetches the daily files and the 10-minute gap files, caches them per instance, reads `Last-Modified`. Tested with a mocked `fetch`.                                                                                |
| `src/routes/api.fires.ts`                          | `GET /api/fires?h=6\|24\|48`. Validates `h`, sets cache headers, returns 502 if INPE fails with nothing cached.                                                                                                                 |
| `src/features/fires/use-fires.ts`                  | Client hook on TanStack Query: one cached entry per window, refetch every 5 minutes while visible and on refocus, 3 retries, previous window kept on screen while loading, `refreshFailed` when a refresh fails over old data.  |
| `src/features/fires/view.ts`                       | Pure client shaping: `selectFires`, `summarize`, `estimateFires`, `hourlyCounts`, `boundsOf`, `toFeatures`, `freshness`.                                                                                                        |
| `src/features/fires/export.ts`                     | Pure: CSV and GeoJSON downloads of the detections on screen.                                                                                                                                                                    |
| `src/features/fires/components/TopFires.tsx`       | The biggest-fires list; a row zooms the map to the fire (`FireTarget`) and opens its newest detection.                                                                                                                          |
| `src/features/fires/components/Timeline.tsx`       | Play/pause and slider over the window's hours; sets `until`, and announces the position for screen readers.                                                                                                                     |
| `src/features/share/card.ts`                       | Share-card URL (`cardPath`, without `bbox`), its parsing and the region label.                                                                                                                                                  |
| `src/features/share/card-map.ts`                   | Pure: the card's mini map (projection, simplified outlines, age-coloured dots).                                                                                                                                                 |
| `src/features/share/card.server.tsx`               | Renders the 1200×630 card PNG with satori and resvg (fonts and wasm inlined via `?base64`).                                                                                                                                     |
| `src/routes/og.ts`                                 | `GET /og?…`: the card for a view, cached 10 min on the CDN.                                                                                                                                                                     |
| `src/features/share/components/CopyLinkButton.tsx` | Copies the current URL (the whole view, including the map position).                                                                                                                                                            |
| `src/features/fires/components/FireMap.tsx`        | MapLibre map (lazy, client-only): clustered GeoJSON source, state outline, popups, fit-to-selection.                                                                                                                            |
| `src/features/fires/components/FirePanel.tsx`      | Floating panel (bottom sheet on phones): headline, freshness, hourly chart, legend, filters, rankings.                                                                                                                          |
| `src/routes/index.tsx`                             | Home page (`/`): Brazil's summary and the map.                                                                                                                                                                                  |
| `src/routes/rankings.tsx`                          | `/rankings`: states and cities by detections this year so far, and cities furthest above their own average (`rankings.server.ts`).                                                                                              |
| `src/routes/states.index.tsx`                      | `/states`: every state with its numbers, and Brazil's history.                                                                                                                                                                  |
| `src/routes/states.$state.tsx`                     | `/states/pa`: a state's page; 404 for unknown states, lower-case redirect.                                                                                                                                                      |
| `src/routes/cities.$state.$city.tsx`               | `/cities/pa/altamira`: a city's page; 404 for unknown cities.                                                                                                                                                                   |
| `src/routes/sitemap[.]xml.ts`                      | Every page's URL, for search engines (`public/robots.txt` points to it).                                                                                                                                                        |
| `src/features/fires/components/FiresView.tsx`      | The map and panel shared by every page; the region comes from the page, the rest from the query.                                                                                                                                |
| `src/features/places/`                             | IBGE municipality list and slugs (`places.ts`, `places.server.ts`), page summaries (`regions.server.ts`, `regions.functions.ts`), navigation between pages, intros and typed region links.                                      |
| `src/features/history/`                            | History since 2003: pure aggregation and page series (`build.ts`), the MongoDB document schema (`schemas.ts`), the reader (`history.server.ts`) and the page section. Filled by `scripts/history.ts` (GitHub Action `History`). |
| `src/lib/db.server.ts`                             | One MongoClient per process (`MONGODB_URI`, database `focosbr`).                                                                                                                                                                |
| `src/routes/__root.tsx`                            | Document shell, Mantine and TanStack Query providers, colour-scheme script, progress bar, not-found page, and the devtools in development.                                                                                      |
| `src/lib/route-progress.tsx`                       | `RouteProgress` and `useProgress(active)` for Mantine's nprogress bar.                                                                                                                                                          |
| `src/lib/query-client.ts`                          | TanStack Query defaults (3 retries, refetch on focus, 15-minute cache).                                                                                                                                                         |
| `src/lib/devtools.tsx`                             | TanStack Devtools with Query and Router tabs; development only.                                                                                                                                                                 |
| `public/data/state-outlines.geojson`               | IBGE state outlines (copied from GeoparqueBR) for the selected-state line.                                                                                                                                                      |

## Request flow

1. The page renders on the server with an empty map placeholder; `<ClientOnly>` keeps MapLibre out of SSR.
2. On the client, `useFires(h)` calls `/api/fires?h=…`. The CDN answers most requests; on a miss, the function loads one file per UTC day the window touches (two or three), from memory when fresh.
3. `view.ts` turns the columnar payload into map features and panel numbers for the current filters. Changing a filter only re-runs these (tens of milliseconds for 48 h of data); changing the window refetches.
4. `FireMap` updates its GeoJSON source in place and fits the view only when the _selection_ changes.

## Caching

| Layer                         | Lifetime                                   | Notes                                                                                      |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Function memory, today's file | 5 min                                      | Concurrent requests share one fetch. On error, the previous copy keeps serving.            |
| Function memory, past days    | 60 min                                     | They barely change after midnight UTC.                                                     |
| Function memory, 10-min files | 7 h                                        | Published files never change. A not-yet-published one (404) isn't cached.                  |
| CDN                           | `s-maxage=300, stale-while-revalidate=600` | Same response for everyone for 5 minutes.                                                  |
| Browser HTTP cache            | `max-age=60`                               | Mostly bypassed by the Query cache below.                                                  |
| TanStack Query (memory)       | fresh 1 min, kept 15 min                   | Per window. Switching back is instant; refetches every 5 min while visible and on refocus. |

Memory caches are per instance and vanish on cold starts; that only costs one INPE fetch.

## Map layers

From bottom to top over the OpenFreeMap basemap:
1. `state-outline`: line, filtered to the selected `uf`.
2. `fire-clusters` and `fire-cluster-count`: up to zoom 6 (`CLUSTER_MAX_ZOOM`), radius 40 px. The cluster colour is its _newest_ detection's age band (`clusterProperties.newest = min(age)`); clicking zooms to where it splits.
3. `fires`: single detections, coloured by age band, sized by FRP and zoom, newest drawn on top. Clicking one eases it to the bottom of the visible area and opens a popup above it (DOM-built, no HTML strings). The popup shows place, time, satellite and resolution, FRP, INPE's weather when present, the fire it belongs to, and coordinates with an OpenStreetMap link.
