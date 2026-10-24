# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

FocosBR is a TanStack Start app that maps live satellite fire hotspots ("focos de calor") in Brazil from INPE's Programa Queimadas. It has no database: one API route fetches and caches INPE's daily CSVs, and the browser does the filtering, counting and charting.

Deeper docs: [architecture](docs/architecture.md) · [data](docs/data.md) · [development](docs/development.md) · [deployment](docs/deployment.md)

## Commands

Use **pnpm**, never npm or yarn.

| Task                               | Command                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| Install                            | `pnpm install`                                                   |
| Dev server (http://localhost:3000) | `pnpm dev`                                                       |
| Typecheck                          | `pnpm typecheck`                                                 |
| Lint + format check                | `pnpm lint`                                                      |
| Auto-fix lint/format               | `pnpm format`                                                    |
| Tests                              | `pnpm test` (`pnpm test:watch` while developing)                 |
| Production build                   | `pnpm build` (Nitro: `.output/`, or `.vercel/output/` on Vercel) |
| Run production build               | `pnpm start`                                                     |

Before you call a change done, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. For UI changes, also load the page, check the browser console, and look at it at 375 px as well as desktop.

## Git

- Default branch is `main`.
- Commit as you go, in **atomic Conventional Commits**: one logical change per commit (`feat(map): …`, `fix: …`, `chore: …`, `docs: …`), staging only that change's files.

## Tests

- **Vitest**, configured in `vitest.config.ts`. That file is separate from `vite.config.ts`, so tests don't load the TanStack Start plugin. Tests live next to the code as `*.test.ts`.
- **What to test.** Parsing (`inpe.ts`) and client-side shaping (`view.ts`) are pure and exported so they can be tested without the network or MapLibre. Feed them fixtures; never hit INPE from a test.
- **Bugs.** Add a regression test with every bug fix.

## Stack and versions

- **TanStack Start 1.x** (Vite 8 plugin, Nitro 3). The API is a file route with `server.handlers` (`src/routes/api.fires.ts`).
- **Zod 4**: `z.iso.datetime()`, `z.url()` and so on, not the Zod 3 method forms.
- **TanStack Query 5** for fetching `/api/fires` (`use-fires.ts`, client in `src/lib/query-client.ts`). **TanStack Devtools** (Query and Router tabs) load only in development (`src/lib/devtools.tsx`, behind `import.meta.env.DEV`); keep them out of production builds.
- **Mantine 9** (React 19.2+), with `@mantine/nprogress` for the top progress bar. Use Mantine components and style props before writing custom CSS.
- **Phosphor icons** (`@phosphor-icons/react`) for every icon.
- **MapLibre GL 6** with OpenFreeMap's `liberty` style (free, keyless).
- **Biome 2**: default formatting (tabs, double quotes). Don't add style overrides.
- **TypeScript 7** (`tsc` is the native compiler), `strict` + `noUncheckedIndexedAccess`.

## Architecture rules

1. **Payload changes stay backward compatible.** The CDN and browsers can hold a response from before a deploy for minutes. A field added to `FiresResponseSchema` needs a `.default()`, and code reading it must handle the default (a missing `prelim[i]` counts as 0). Never rename or retype a field in place.
2. **Zod schemas are the single source of truth.** `src/features/fires/schemas.ts` defines the API payload (`FiresResponseSchema`) and the page's URL state (`FiresSearchSchema`). Derive types with `z.infer`; never hand-write a duplicate interface.
3. **Server-only code lives in `*.server.ts`** and is imported **lazily** from the API route (`await import(...)`), so it stays out of the client graph. Never import it from components.
4. **Feature folders.** Domain code goes in `src/features/<feature>/` (`schemas.ts`, pure helpers, `<feature>.server.ts`, `components/`). Shared infrastructure goes in `src/lib/`.
5. **URL state.** Anything a user would share or bookmark lives in search params validated by Zod: `h` (window), `sensor`, `uf`, `bioma`, `municipio`. Don't move these into `useState`. Defaults are left out of the URL (`h=24` is omitted).
6. **Fetch through TanStack Query, not `useEffect`.** `useFires` caches each window (`["fires", hours]`), refetches every 5 minutes only while the tab is visible and on refocus, retries 3 times, and keeps the previous window on screen while a new one loads. Code that labels the data must use `data.hours`, not the URL's `h`, since the two differ while a window loads. Don't render the fire payload during SSR: it's too big for the HTML.
7. **The browser filters; the server doesn't.** `/api/fires` returns every detection in the window. `view.ts` selects, counts, merges and buckets on the client, so every filter change is instant and the CDN caches just three responses (one per window).
8. **Browser-only libraries load lazily.** MapLibre sits behind `<ClientOnly>` + `React.lazy` in a default-exported component (`FireMap.tsx`). Keep `setWorkerUrl(workerUrl)` there: Vite rebundles MapLibre and its worker can't be found otherwise.
9. **Mobile first-paint uses CSS.** Lay out with Mantine responsive style props (`top={{ base, sm }}`), not JS breakpoints. On phones the panel is a bottom sheet (45dvh); `panelPadding()` in `FireMap.tsx` keeps fits and cluster zooms in the visible part of the map. Change both together.

## Domain invariants

- **A "foco" is a satellite detection, not a confirmed fire.** The UI must keep saying so. The headline number is an _estimate_ of distinct fires (`estimateFires`: detections within 2 km and 1 h are joined, transitively); the raw detection count stays next to it.
- GeoJSON coordinates are **`[longitude, latitude]`**. Bounds are `[west, south, east, north]`.
- Times travel as **UTC**: Unix seconds in the payload, ISO strings for timestamps. Show them in **`America/Sao_Paulo`** and say "horário de Brasília" where a bare time could be misread.
- **INPE text stays as published** (Portuguese): biome names are used verbatim as filter values (`bioma=Amazônia`). Municipality names are only title-cased and suffixed with the state (`"Altamira (PA)"`); that label is also the `municipio` filter value. State codes come from IBGE's `estado_id`, never from parsing the state name.
- Offshore and border detections can have an **empty** state or biome. Show "—" and never let it be selected.
- **Each breakdown ignores its own filter** (`summarize`): with a state selected, the state list and sensor chips still show every option with its count.
- **The map fits once per selection** (`focus.key`). Data refreshes and sensor changes must never move the map away from where the user panned.
- **Colours are validated, not picked.** The age ramp (`AGE_BANDS`) is an ordinal one-hue ramp and the chart bar (`--chart-bar`) has a separate light and dark step; both were checked with the dataviz palette validator. Re-validate any colour change. Text never wears a data colour.
- **The gap is cut by publish time.** Between daily rewrites, detections come from INPE's 10-minute files published _after_ the current day's daily file was last rewritten (its `Last-Modified`), not from detections newer than the daily file's latest. Late-processed satellite passes land in files published hours after the pass, so a time-based cutoff loses them. They're merged with `mergeDetections`, which drops exact repeats.
- **Weather fields are null until INPE closes the day.** `dry`, `rain` and `risk` are empty in today's file and filled in the next morning's rewrite. Show them only when present, and never fill them in with defaults or zeros. A missing value and `0 mm` mean different things.
- **Preliminary detections** (`prelim: 1`) have a state we located ourselves (`locate.ts`, about 99.9% agreement with INPE), and no municipality, biome or FRP. Say so wherever they show up, and never invent the missing fields. They're replaced on INPE's next rewrite.
- **`public/data/state-outlines.geojson` is the single copy of the outlines.** The map fetches it, and the server bundles it with `?raw` (Vercel functions can't read `public/`). Don't add a second copy.
- **Freshness is measured, not assumed.** INPE's daily file does _not_ update every 10 minutes; gaps of 50+ minutes are normal. `sourceUpdatedAt` comes from its `Last-Modified`, and the UI warns past `STALE_AFTER_MINUTES` (120). Don't promise a cadence in copy.
- **All UI copy is Brazilian Portuguese.** There is no i18n layer yet; keep strings in components until there is.
