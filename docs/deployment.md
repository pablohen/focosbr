# Deployment

**Status: live at <https://focosbr.vercel.app>** (since 2026-10-24).

|                   |                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------- |
| Repository        | <https://github.com/pablohen/focosbr> (public)                                          |
| Vercel team       | `pablohens-projects` (same as GeoparqueBR)                                              |
| Vercel project    | `focosbr` (`prj_oyh54SQoUyaD1sROdMoBMS5MEzx5`)                                          |
| Production branch | `main`: every push deploys to production                                                |
| Framework preset  | `nitro` (auto-detected; GeoparqueBR's says `tanstack-start`, and both run `vite build`) |
| Node              | 24.x                                                                                    |

## Target

Vercel, region **`gru1` (São Paulo)**: next to the users and to INPE's data server. Set in `vite.config.ts`:

```ts
nitro({ vercel: { functions: { regions: ["gru1"], maxDuration: 30 } } });
```

Nitro picks its preset from the environment: on Vercel (`VERCEL=1`) the build writes `.vercel/output/`; elsewhere, a standalone Node server in `.output/` (`pnpm start`).

## What it needs

- **No environment variables, no database, no cron.** The only external calls are to INPE (server) and OpenFreeMap tiles (browser).
- `maxDuration: 30` covers a cold 48 h request: three ~4 MB CSVs fetched in parallel and parsed.

## How it was set up

The project was created with the Vercel connector's `create_git_project` (linked to the GitHub repo); no CLI or `vercel.json` needed. To redeploy, push to `main`.

## Checking a deploy

- **Region:** the build runs on Vercel's build machines (`iad1`, Washington); that's expected. The _function_ must run in São Paulo: `curl -sI https://focosbr.vercel.app/api/fires?h=24 | grep x-vercel-id` shows `gru1::gru1::…`.
- **CDN:** the response's `cache-control` shows only `public, max-age=60`. Vercel consumes `s-maxage` and `stale-while-revalidate` itself and strips them, so that's expected. A second request within 5 minutes shows `x-vercel-cache: HIT`.
- **CI:** GitHub Actions runs lint, typecheck, tests and build on every push and PR (`gh run list`). Vercel deploys `main` even if CI fails, so check it.
- **Share cards:** `/og` → `image/png`, ~50–100 KB (WhatsApp drops previews over ~300 KB). Preview a link's card with any OG debugger, or open `/og?uf=PA` directly.
- **Endpoints:** `/api/fires?h=6|24|48` → 200 (cold 48 h ≈ 1.2 s), `?h=7` → 400, `/nao-existe` → 404, `/data/state-outlines.geojson` → 200.

## Operations

- **INPE down:** `/api/fires` serves the last good copy from memory; with nothing cached it returns 502 and the panel shows an error, retrying every 5 minutes.
- **INPE stale:** the panel shows an orange warning when `Last-Modified` is over 2 hours old. Nothing to fix on our side.
- **Format change upstream:** the parser throws on an unexpected header (logged as `fires fetch failed`). Update `parseInpeCsv` and its fixture test.
