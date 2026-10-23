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
- **Mantine 9** (React 19.2+), with `@mantine/nprogress` for the top progress bar. Use Mantine components and style props before writing custom CSS.
- **Phosphor icons** (`@phosphor-icons/react`) for every icon.
- **MapLibre GL 6** with OpenFreeMap's `liberty` style (free, keyless).
- **Biome 2**: default formatting (tabs, double quotes). Don't add style overrides.
- **TypeScript 7** (`tsc` is the native compiler), `strict` + `noUncheckedIndexedAccess`.

## Architecture rules

1. **Zod schemas are the single source of truth.** `src/features/fires/schemas.ts` defines the API payload (`FiresResponseSchema`) and the page's URL state (`FiresSearchSchema`). Derive types with `z.infer`; never hand-write a duplicate interface.
2. **Server-only code lives in `*.server.ts`** and is imported **lazily** from the API route (`await import(...)`), so it stays out of the client graph. Never import it from components.
3. **Feature folders.** Domain code goes in `src/features/<feature>/` (`schemas.ts`, pure helpers, `<feature>.server.ts`, `components/`). Shared infrastructure goes in `src/lib/`.
4. **URL state.** Anything a user would share or bookmark lives in search params validated by Zod: `h` (window), `sensor`, `uf`, `bioma`, `municipio`. Don't move these into `useState`. Defaults are left out of the URL (`h=24` is omitted).
5. **The browser filters; the server doesn't.** `/api/fires` returns every detection in the window. `view.ts` selects, counts, merges and buckets on the client, so every filter change is instant and the CDN caches just three responses (one per window).
6. **Browser-only libraries load lazily.** MapLibre sits behind `<ClientOnly>` + `React.lazy` in a default-exported component (`FireMap.tsx`). Keep `setWorkerUrl(workerUrl)` there: Vite rebundles MapLibre and its worker can't be found otherwise.
7. **Mobile first-paint uses CSS.** Lay out with Mantine responsive style props (`top={{ base, sm }}`), not JS breakpoints. On phones the panel is a bottom sheet (45dvh); `panelPadding()` in `FireMap.tsx` keeps fits and cluster zooms in the visible part of the map. Change both together.

## Domain invariants

- **A "foco" is a satellite detection, not a confirmed fire.** The UI must keep saying so. The headline number is an _estimate_ of distinct fires (`estimateFires`: detections within 2 km and 1 h are joined, transitively); the raw detection count stays next to it.
- GeoJSON coordinates are **`[longitude, latitude]`**. Bounds are `[west, south, east, north]`.
- Times travel as **UTC**: Unix seconds in the payload, ISO strings for timestamps. Show them in **`America/Sao_Paulo`** and say "horário de Brasília" where a bare time could be misread.
- **INPE text stays as published** (Portuguese): biome names are used verbatim as filter values (`bioma=Amazônia`). Municipality names are only title-cased and suffixed with the state (`"Altamira (PA)"`); that label is also the `municipio` filter value. State codes come from IBGE's `estado_id`, never from parsing the state name.
- Offshore and border detections can have an **empty** state or biome. Show "—" and never let it be selected.
- **Each breakdown ignores its own filter** (`summarize`): with a state selected, the state list and sensor chips still show every option with its count.
- **The map fits once per selection** (`focus.key`). Data refreshes and sensor changes must never move the map away from where the user panned.
- **Colours are validated, not picked.** The age ramp (`AGE_BANDS`) is an ordinal one-hue ramp and the chart bar (`--chart-bar`) has a separate light and dark step; both were checked with the dataviz palette validator. Re-validate any colour change. Text never wears a data colour.
- **Freshness is measured, not assumed.** INPE's daily file does _not_ update every 10 minutes; gaps of 50+ minutes are normal. `sourceUpdatedAt` comes from its `Last-Modified`, and the UI warns past `STALE_AFTER_MINUTES` (120). Don't promise a cadence in copy.
- **All UI copy is Brazilian Portuguese.** There is no i18n layer yet; keep strings in components until there is.
