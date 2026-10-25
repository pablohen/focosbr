# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

FocosBR is a TanStack Start app that maps live satellite fire hotspots ("focos de calor") in Brazil from INPE's Programa Queimadas. The live map has no database: one API route fetches and caches INPE's daily CSVs, and the browser does the filtering, counting and charting. The state and city pages' **history** (since 2003) lives in MongoDB Atlas, filled daily by a GitHub Action (`pnpm history:build`).

Deeper docs: [architecture](docs/architecture.md) · [data](docs/data.md) · [development](docs/development.md) · [deployment](docs/deployment.md)

## Commands

Use **pnpm**, never npm or yarn.

| Task                               | Command                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Install                            | `pnpm install`                                                                                                      |
| Dev server (http://localhost:3000) | `pnpm dev`                                                                                                          |
| Typecheck                          | `pnpm typecheck`                                                                                                    |
| Lint + format check                | `pnpm lint`                                                                                                         |
| Auto-fix lint/format               | `pnpm format`                                                                                                       |
| Tests                              | `pnpm test` (`pnpm test:watch` while developing)                                                                    |
| Production build                   | `pnpm build` (Nitro: `.output/`, or `.vercel/output/` on Vercel)                                                    |
| Run production build               | `pnpm start`                                                                                                        |
| Refresh the fire-risk forecast     | `pnpm forecast:build` (INPE's rasters → `forecast`; daily in the History workflow). Needs `MONGODB_URI`             |
| Regenerate centroids / app icons   | `pnpm geo:centroids` (IBGE mesh → `places/centroids.json`), `pnpm icons` (favicon flame → `public/icons`)           |
| Refresh history in MongoDB         | `pnpm history:build` (daily: this and last month, last 31 days; `--backfill` once: since 2003). Needs `MONGODB_URI` |

Before you call a change done, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. CI (`.github/workflows/ci.yml`) runs the same four on every push to `main` and every pull request; Vercel deploys `main` regardless, so don't push red. For UI changes, also load the page, check the browser console, and look at it at 375 px as well as desktop.

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
- **Mantine 9** (React 19.2+), with `@mantine/nprogress` for the top progress bar and `@mantine/spotlight` for the header's place search (`SearchButton`, which lazy-loads the dialog and IBGE's list on first use). Use Mantine components and style props before writing custom CSS.
- **Phosphor icons** (`@phosphor-icons/react`) for every icon.
- **MapLibre GL 6** with OpenFreeMap's `liberty` style (free, keyless).
- **Biome 2**: default formatting (tabs, double quotes). Don't add style overrides.
- **TypeScript 7** (`tsc` is the native compiler), `strict` + `noUncheckedIndexedAccess`.

## Architecture rules

1. **Payload changes stay backward compatible.** The CDN and browsers can hold a response from before a deploy for minutes. A field added to `FiresResponseSchema` needs a `.default()`, and code reading it must handle the default (a missing `prelim[i]` counts as 0). Never rename or retype a field in place.
2. **Zod schemas are the single source of truth.** `src/features/fires/schemas.ts` defines the API payload (`FiresResponseSchema`) and the page's URL state (`FiresSearchSchema`). Derive types with `z.infer`; never hand-write a duplicate interface.
3. **Server-only code lives in `*.server.ts`** and is imported **lazily** from the API route (`await import(...)`), so it stays out of the client graph. Never import it from components.
4. **Feature folders.** Domain code goes in `src/features/<feature>/` (`schemas.ts`, pure helpers, `<feature>.server.ts`, `components/`). Shared infrastructure goes in `src/lib/`.
5. **URLs are English.** The interactive map is `/`, and all of its state lives in the query: `h` (window), `sensor`, `state` (`PA`), `city` (`Altamira (PA)`), `biome`, `bbox` (the map area left visible beside the panel, written only by the user's own moves, with `replace`). Details pages: `/states`, `/rankings`, `/biomes`, `/states/<state>` (`/states/pa`), `/cities/<state>/<city>` (`/cities/pa/altamira`, the slug of IBGE's official name), `/biomes/<biome>` (`/biomes/mata-atlantica`, the slug of INPE's name), with only `h`. Comparison: `/compare?places=pa,mt,biome/pantanal&scale=index` (region keys, see below; an emptied slot stays as a gap so colours keep to places). Also `/week`, `/years`, `/years/<year>`, `/alerts`, `/data` and the open API (`/api/history/<key>`, `/api/alerts`, `/feed.xml`). Embeds: `/embed`, `/embed/states/pa`, `/embed/cities/pa/altamira`, `/embed/biomes/amazonia` (noindex, canonical to the full page). Share cards: `/og?h=&sensor=&biome=&state=&city=`, `/og/week`, `/og/years/<year>` (routes named `og_.…` so they don't nest under `/og`). Never `uf`, `municipio`, `bioma` or other Portuguese names in paths or parameters (UI copy stays Portuguese). Don't move URL state into `useState`; defaults stay out of the URL (`h=24` is omitted). The timeline position is playback state and stays in `useState`. Old URLs aren't redirected.
6. **Fetch through TanStack Query, not `useEffect`.** `useFires` caches each window (`["fires", hours]`), refetches every 5 minutes only while the tab is visible and on refocus, retries 3 times, and keeps the previous window on screen while a new one loads. Code that labels the data must use `data.hours`, not the URL's `h`, since the two differ while a window loads. Don't render the fire payload during SSR: it's too big for the HTML.
7. **The browser filters; the server doesn't.** `/api/fires` returns every detection in the window. `view.ts` selects, counts, merges and buckets on the client, so every filter change is instant and the CDN caches just three responses (one per window).
8. **Browser-only libraries load lazily.** MapLibre sits behind `<ClientOnly>` + `React.lazy` in a default-exported component (`FireMap.tsx`). Keep `setWorkerUrl(workerUrl)` there: Vite rebundles MapLibre and its worker can't be found otherwise.
9. **Pages share one frame.** Content pages render inside `PageShell` (the `SiteHeader` bar, the standard container, the `SiteFooter` with every section and the data attribution); the map puts `SiteHeader bare` in its AppShell. New sections go in the footer's groups, not in ad-hoc link lists. Tables use `LIST_TABLE` (lists and rankings, with a `#` column when ranked and a first column named for what it holds) or `COMPACT_TABLE` (charts' table views) from `src/lib/tables.ts`. Interactive targets are at least 24 px (chart toggles are `ActionIcon size="md"`). Page tops use `PageTitle` (title, a lead in body text, a small muted note); missing data shows `Unavailable`; the headline is `FireEstimate`. Dates go through `src/lib/dates.ts` (long in sentences, short in labels, moments in Brasília), never numeric day/month. The map's basemap follows the colour scheme (OpenFreeMap `liberty` / `dark`, swapped with `transformStyle` so our layers stay).
10. **Mobile first-paint uses CSS.** Lay out with Mantine responsive style props (`top={{ base, sm }}`), not JS breakpoints. On phones the panel is a bottom sheet (45dvh); `panelPadding()` in `FireMap.tsx` keeps fits and cluster zooms in the visible part of the map. Change both together.

## Domain invariants

- **A "foco" is a satellite detection, not a confirmed fire.** The UI must keep saying so. The headline number is an _estimate_ of distinct fires (`estimateFires`: detections within 2 km and 1 h are joined, transitively); the raw detection count stays next to it.
- GeoJSON coordinates are **`[longitude, latitude]`**. Bounds are `[west, south, east, north]`.
- Times travel as **UTC**: Unix seconds in the payload, ISO strings for timestamps. Show them in **`America/Sao_Paulo`** and say "horário de Brasília" where a bare time could be misread.
- **INPE text stays as published** (Portuguese): biome names are used verbatim as filter values (`biome=Amazônia`). Municipality names are **IBGE's official names**, matched by INPE's `municipio_id` (`src/features/places/municipalities.json`, from `pnpm geo:municipalities`), falling back to INPE's name title-cased; the label adds the state (`"Altamira (PA)"`) and is the city filter value. State codes come from IBGE's `estado_id`, never from parsing the state name.
- Offshore and border detections can have an **empty** state or biome. Show "—" and never let it be selected.
- **Each breakdown ignores its own filter** (`summarize`): with a state selected, the state list and sensor chips still show every option with its count.
- **The map fits once per selection** (`focus.key`). Data refreshes and sensor changes must never move the map away from where the user panned.
- **Colours are validated, not picked.** The age ramp (`AGE_BANDS`) is an ordinal one-hue ramp and the chart bar (`--chart-bar`) has a separate light and dark step; both were checked with the dataviz palette validator, as were the calendar's ramp (`--cal-*`) and the rankings map's diverging scale (`--anom-*`, each arm as an ordinal ramp, grey midpoint). Re-validate any colour change. Text never wears a data colour.
- **The gap is cut by publish time.** Between daily rewrites, detections come from INPE's 10-minute files published _after_ the current day's daily file was last rewritten (its `Last-Modified`), not from detections newer than the daily file's latest. Late-processed satellite passes land in files published hours after the pass, so a time-based cutoff loses them. They're merged with `mergeDetections`, which drops exact repeats.
- **Weather fields are null until INPE closes the day.** `dry`, `rain` and `risk` are empty in today's file and filled in the next morning's rewrite. Show them only when present, and never fill them in with defaults or zeros. A missing value and `0 mm` mean different things.
- **Preliminary detections** (`prelim: 1`) have a state we located ourselves (`locate.ts`, about 99.9% agreement with INPE), and no municipality, biome or FRP. Say so wherever they show up, and never invent the missing fields. They're replaced on INPE's next rewrite.
- **`public/data/state-outlines.geojson` is the single copy of the outlines.** The map fetches it, and the server bundles it with `?raw` (Vercel functions can't read `public/`). Don't add a second copy.
- **Freshness is measured, not assumed.** INPE's daily file does _not_ update every 10 minutes; gaps of 50+ minutes are normal. `sourceUpdatedAt` comes from its `Last-Modified`, and the UI warns past `STALE_AFTER_MINUTES` (120). Don't promise a cadence in copy.
- **Share cards show the view, not the position.** `/og` renders the window, sensors and region (`cardPath` drops `bbox`), so equal views share one CDN entry. Satori and resvg stay in the `/og` chunk only. Satori adds padding _outside_ `width`/`height`, so size boxes explicitly instead of padding the root, and Inter's Latin subset has no "≈" (the card says "cerca de").
- **The timeline replays, it doesn't change the data.** `until` filters detections up to a moment, and map ages are measured from it, while the hourly chart always shows the whole window. A new window resets to live.
- **State and city pages are details pages, not the map.** Their loaders call `regions.functions.ts`, and everything on them (numbers, hourly chart, biggest fires, city ranking, biomes, sensors, INPE weather, and a static SVG map drawn from server-side paths) renders on the server, for readers, crawlers and link previews. They link to the interactive map with `?state=&city=` (and `bbox` for a fire). Unknown states and cities are `notFound()` (404). Keep their HTML small: dots are one path per age band (`dotsPath`), outlines outside the frame are culled, at most 2,000 dots. Biome pages are the same details pages filtered by biome; their map frames all of Brazil (there are no biome outlines). `sitemap.xml` lists every page (home, `/states`, `/rankings`, `/biomes`, 27 states, 6 biomes, every IBGE municipality), never the embeds.
- **History is extra and comparable.** `history` holds one document per region (`_id` "BR", "PA", the IBGE code or "biome/amazonia") with sparse `months` (reference satellite, AQUA's afternoon pass) and `days` (all satellites), in Brasília time. Years are sums of months. Never mix the two series: only the reference satellite is comparable across years. `refDays` (reference satellite by day) feeds the year-to-date comparison, which always stops at yesterday, the last closed day, in every year; the script stores it as `ytd` on every document for `/rankings`. The script _sets_ the periods it processed (idempotent); never `$inc`. Pages read one document through `loadRegionHistory`, which returns null on any failure so the page renders without history.
- **Region keys** (`places/region-key.ts`) name a region everywhere outside page paths: `br`, `pa`, `pa/altamira`, `biome/amazonia`. They parse purely and resolve on the server (`resolve.server.ts`) to a name, page, history id and fire filters. Use them for new region-addressed features.
- **Alerts are written once.** The history script stores them in `alerts` with deterministic ids (`double:<id>:<year>`, `record-day:<id>:<day>`) and `$setOnInsert`, so re-runs never duplicate or re-date them. The rules (`alerts.ts`) are pure and tested; change them there.
- **Summaries are precomputed.** `/week` and the year pages each read one document from `summaries` (`week`, `year/<y>`), written by the history script from every region's series. Don't aggregate across regions at request time.
- **The forecast is labelled by its issue date.** INPE's rasters (`RF.PREV.T0`–`T3`) don't carry their day; `scripts/forecast.ts` takes it from `Last-Modified` and pages show only days from today on (`upcomingDays`), saying when the latest is too old. The risk index is how prone vegetation is to burn, not a chance of fire: keep the copy saying so.
- **The service worker is network-first** for pages and `/api/fires` (cache only as an offline fallback) and cache-first only for hashed `/assets/`. Bump `CACHE` in `public/sw.js` if its strategy changes; it registers in production only.
- **Server-rendered relative times need the server's clock** for their first render (`Freshness`'s `renderedAt`), or hydration fails across a minute boundary.
- **All UI copy is Brazilian Portuguese.** There is no i18n layer yet; keep strings in components until there is.
