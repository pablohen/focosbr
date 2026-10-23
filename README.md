# FocosBR

Live map of satellite fire hotspots ("focos de calor") in Brazil, from INPE's Programa Queimadas.

Same stack as GeoparqueBR: TanStack Start, Mantine 9, MapLibre GL 6 with OpenFreeMap tiles, Phosphor icons, Zod 4, Biome and pnpm. It deploys to Vercel in `gru1` (São Paulo).

## How it works

- `GET /api/fires?h=6|24|48` fetches INPE's daily Brazil files (`focos_diario_br_YYYYMMDD.csv`, one per UTC day, rewritten about every 10 minutes). It keeps the detections inside the window and returns them in columnar form.
- Each instance caches the parsed files: today's for 5 minutes, earlier days for an hour. The response sends `s-maxage=300`, so the CDN serves everyone the same copy for 5 minutes. No database and no API key.
- The page refetches every 5 minutes. The window (`h`) and sensor filter (`sensor`) live in the URL.
- Dots are coloured by age (under 3 h, 3–12 h, over 12 h) and sized by fire radiative power.

A hotspot is a satellite detection of heat, not a confirmed fire. The same fire can show up on several satellites, and clouds or smoke hide fires.

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

## Data

INPE, Programa Queimadas: <https://terrabrasilis.dpi.inpe.br/queimadas/portal/>. Basemap © OpenMapTiles, © OpenStreetMap contributors, served by OpenFreeMap.
