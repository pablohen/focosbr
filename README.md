# FocosBR

Live map of satellite fire hotspots ("focos de calor") in Brazil, from INPE's Programa Queimadas.

Same stack as GeoparqueBR: TanStack Start, Mantine 9, MapLibre GL 6 with OpenFreeMap tiles, Phosphor icons, Zod 4, Biome and pnpm. Targets Vercel in `gru1` (São Paulo).

## Features

- Hotspots from the last 6, 24 or 48 hours, coloured by age and sized by fire radiative power. They cluster at low zoom, and clicking a cluster zooms in.
- An estimated count of distinct fires: detections within 2 km and 1 hour are merged, shown next to the raw detection count.
- Filters by sensor (VIIRS, MODIS, GOES…), state, biome and municipality. The map zooms to the selection, and each list keeps its counts while you filter.
- Detections per hour as a chart, and rankings of states, biomes and municipalities.
- How fresh INPE's data is, with a warning when the feed is over two hours old.
- Every filter lives in the URL, so a view can be shared. The page refreshes every 5 minutes.

A hotspot is a satellite detection of heat, not a confirmed fire. Clouds and smoke hide fires.

## Commands

| Task                               | Command                     |
| ---------------------------------- | --------------------------- |
| Install                            | `pnpm install`              |
| Dev server (http://localhost:3000) | `pnpm dev`                  |
| Lint / auto-fix                    | `pnpm lint` / `pnpm format` |
| Typecheck                          | `pnpm typecheck`            |
| Tests                              | `pnpm test`                 |
| Production build                   | `pnpm build`                |

Before calling a change done, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Docs

- [AGENTS.md](AGENTS.md): conventions, architecture rules and domain invariants (read this first)
- [Architecture](docs/architecture.md): files, request flow, caching, map layers
- [Data](docs/data.md): the INPE source, the API payload, derived numbers
- [Development](docs/development.md): setup, checks, adding a filter, gotchas
- [Deployment](docs/deployment.md): Vercel setup and operations

## Data

INPE, Programa Queimadas: <https://terrabrasilis.dpi.inpe.br/queimadas/portal/>. Basemap © OpenMapTiles, © OpenStreetMap contributors, served by OpenFreeMap.
