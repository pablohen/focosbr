# FocosBR

Live map of satellite fire hotspots ("focos de calor") in Brazil, from INPE's Programa Queimadas.

Same stack as GeoparqueBR: TanStack Start, Mantine 9, MapLibre GL 6 with OpenFreeMap tiles, Phosphor icons, Zod 4, Biome and pnpm. Targets Vercel in `gru1` (São Paulo).

## Features

- Hotspots from the last 6, 24 or 48 hours, coloured by age and sized by fire radiative power. They cluster at low zoom, and clicking a cluster zooms in.
- An estimated count of distinct fires: detections within 2 km and 1 hour are merged, shown next to the raw detection count.
- Filters by sensor (VIIRS, MODIS, GOES…), state, biome and municipality. The map zooms to the selection, and each list keeps its counts while you filter.
- The biggest fires right now, by detections or by power. Clicking one zooms the map to it and opens its newest detection.
- Detections per hour as a chart, with a table view, and rankings of states, biomes and municipalities.
- Download of the filtered detections as CSV or GeoJSON, with INPE's attribution.
- Gaps between INPE's daily updates are filled from its 10-minute files. Those detections are marked preliminary, with the state located from IBGE outlines, until the next update.
- How fresh INPE's data is, with a warning when the feed is over two hours old.
- A timeline replays the window hour by hour: the map, counts and lists show what had been detected up to each hour.
- A details page for every state and city (`/states/pa`, `/cities/pa/altamira`): numbers, a map, detections per hour, the biggest fires, cities, biomes, sensors and INPE's weather, rendered on the server, with links into the interactive map, and history since 2003 (per year and per month from INPE's reference satellite, per day from all satellites) stored in MongoDB. Each page compares this year so far with the same period of every year since 2003, tracks the season's running total against past years' range, average and record, and shows a fire-season calendar (month × year). Plus `/states` (with Brazil's history), `/rankings` (a map of states above and below their own average, states and cities this year, and cities furthest above their own average), a state and city search (⌘K) and a sitemap.
- Every filter and the map position live in the URL, with a copy-link button. Shared links get a preview card with the view's fire estimate and a mini map.
- The page refreshes every 5 minutes.

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
