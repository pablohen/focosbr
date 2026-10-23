# Deployment

**Status: not deployed yet.**

## Target

Vercel, region **`gru1` (São Paulo)**: next to the users and to INPE's data server. Set in `vite.config.ts`:

```ts
nitro({ vercel: { functions: { regions: ["gru1"], maxDuration: 30 } } });
```

Nitro picks its preset from the environment: on Vercel (`VERCEL=1`) the build writes `.vercel/output/`; elsewhere, a standalone Node server in `.output/` (`pnpm start`).

## What it needs

- **No environment variables, no database, no cron.** The only external calls are to INPE (server) and OpenFreeMap tiles (browser).
- `maxDuration: 30` covers a cold 48 h request: three ~4 MB CSVs fetched in parallel and parsed.

## First deploy

1. Push the repository to GitHub.
2. Import it in Vercel. Framework preset: _Other_. Build command `pnpm build`, install command `pnpm install`; the output is detected from `.vercel/output/`.
3. Check that the function region is `gru1` and that `/api/fires?h=24` returns JSON with a `cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=600` header.

## Operations

- **INPE down:** `/api/fires` serves the last good copy from memory; with nothing cached it returns 502 and the panel shows an error, retrying every 5 minutes.
- **INPE stale:** the panel shows an orange warning when `Last-Modified` is over 2 hours old. Nothing to fix on our side.
- **Format change upstream:** the parser throws on an unexpected header (logged as `fires fetch failed`). Update `parseInpeCsv` and its fixture test.
