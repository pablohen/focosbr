# Development

## Setup

Requires Node 24+ and pnpm (the version is pinned in `package.json`'s `packageManager`).

```bash
pnpm install
pnpm dev
```

The app runs at http://localhost:3000 (same port as GeoparqueBR, so run one at a time). No `.env` is needed.

`.claude/launch.json` defines the `focosbr` preview for Claude Code.

## Checks

Run all four before calling a change done; CI isn't set up yet, so this is the only gate:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

For UI changes, also open the page, check the browser console, and look at it at 375 px wide and on desktop, in light and dark mode.

## Adding a filter or breakdown

1. Add the search param to `FiresSearchSchema` (optional, `.catch(undefined)`).
2. Add the field to `FireFilters` and its check to `selectFires` in `view.ts`.
3. If it gets a breakdown, add it to `summarize`, leaving its own filter out.
4. Wire it through `routes/index.tsx` (read from search, pass to the panel, include it in `focus.key` if the map should zoom to it).
5. Test the pure parts in `view.test.ts`.

## Gotchas

- **"Invalid hook call" after installing a dependency while the dev server runs.** Vite re-optimizes dependencies and the open page can end up with two copies of React. Stop the server, `rm -rf node_modules/.vite`, start it again, and check in a fresh tab (old console messages stick around after reloads).
- **The map is blank in dev.** Check the console for "Worker failed to load". `setWorkerUrl(workerUrl)` in `FireMap.tsx` must stay.
- **`routeTree.gen.ts` is generated** by the TanStack plugin on `dev`/`build` and is committed. Biome ignores it.
- **Testing in the browser pane:** the in-app preview tab is shared with you. Clicks there change the URL state (`h`, `uf`…), so don't mistake them for app bugs.
