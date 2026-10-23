# Architecture

FocosBR is a single page over a single API route. No database, no cron, no secrets.

```
INPE data server ──CSV──▶ /api/fires (Nitro function, gru1)
                            │  parse + window + pack (inpe.ts)
                            │  per-instance cache (fires.server.ts)
                            ▼
                     Vercel CDN (s-maxage=300)
                            │  columnar JSON
                            ▼
                    Browser (routes/index.tsx)
                            │  useFires: fetch, validate, refetch every 5 min
                            │  view.ts: filter → count → merge → bucket
                            ├──▶ FirePanel (counts, chart, filters)
                            └──▶ FireMap  (MapLibre, clusters, popups)
```

## Files

| Path                                          | Role                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/features/fires/schemas.ts`               | Zod schemas: API payload and URL search params.                                                                          |
| `src/features/fires/inpe.ts`                  | Pure: INPE CSV parsing, day/window maths, `buildFiresResponse` (columnar packing).                                       |
| `src/features/fires/fires.server.ts`          | Server-only: fetches the daily files, caches them per instance, reads `Last-Modified`.                                   |
| `src/routes/api.fires.ts`                     | `GET /api/fires?h=6\|24\|48`. Validates `h`, sets cache headers, returns 502 if INPE fails with nothing cached.          |
| `src/features/fires/use-fires.ts`             | Client hook: fetches the window, validates with Zod, refetches every 5 minutes, keeps old data on screen while loading.  |
| `src/features/fires/view.ts`                  | Pure client shaping: `selectFires`, `summarize`, `estimateFires`, `hourlyCounts`, `boundsOf`, `toFeatures`, `freshness`. |
| `src/features/fires/components/FireMap.tsx`   | MapLibre map (lazy, client-only): clustered GeoJSON source, state outline, popups, fit-to-selection.                     |
| `src/features/fires/components/FirePanel.tsx` | Floating panel (bottom sheet on phones): headline, freshness, hourly chart, legend, filters, rankings.                   |
| `src/routes/index.tsx`                        | The page: reads URL state, wires data → view helpers → map and panel. Header lives here.                                 |
| `src/routes/__root.tsx`                       | Document shell, Mantine provider, colour-scheme script, progress bar, not-found page.                                    |
| `src/lib/route-progress.tsx`                  | `RouteProgress` and `useProgress(active)` for Mantine's nprogress bar.                                                   |
| `public/data/state-outlines.geojson`          | IBGE state outlines (copied from GeoparqueBR) for the selected-state line.                                               |

## Request flow

1. The page renders on the server with an empty map placeholder; `<ClientOnly>` keeps MapLibre out of SSR.
2. On the client, `useFires(h)` calls `/api/fires?h=…`. The CDN answers most requests; on a miss, the function loads one file per UTC day the window touches (two or three), from memory when fresh.
3. `view.ts` turns the columnar payload into map features and panel numbers for the current filters. Changing a filter only re-runs these (tens of milliseconds for 48 h of data); changing the window refetches.
4. `FireMap` updates its GeoJSON source in place and fits the view only when the _selection_ changes.

## Caching

| Layer                         | Lifetime                                   | Notes                                                                           |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Function memory, today's file | 5 min                                      | Concurrent requests share one fetch. On error, the previous copy keeps serving. |
| Function memory, past days    | 60 min                                     | They barely change after midnight UTC.                                          |
| CDN                           | `s-maxage=300, stale-while-revalidate=600` | Same response for everyone for 5 minutes.                                       |
| Browser                       | `max-age=60`                               | The hook refetches every 5 minutes anyway.                                      |

Memory caches are per instance and vanish on cold starts; that only costs one INPE fetch.

## Map layers

From bottom to top over the OpenFreeMap basemap:
1. `state-outline`: line, filtered to the selected `uf`.
2. `fire-clusters` and `fire-cluster-count`: up to zoom 6 (`CLUSTER_MAX_ZOOM`), radius 40 px. The cluster colour is its _newest_ detection's age band (`clusterProperties.newest = min(age)`); clicking zooms to where it splits.
3. `fires`: single detections, coloured by age band, sized by FRP and zoom, newest drawn on top.
