# Ariada Cloudflare Pages/Workers Integration

This is the first Cloudflare-native Ariada channel. It is distinct from earlier Vercel/CI references: Pages builds can call `build-step.sh`, and Workers can proxy a managed hosted scan API call without embedding secrets in source.

Official source checked: https://developers.cloudflare.com/workers/wrangler/configuration/ and https://developers.cloudflare.com/pages/functions/wrangler-configuration/

## Pages build command

```bash
ARIADA_TARGET_URL="$CF_PAGES_URL" ./build-step.sh
```

If `ARIADA_TARGET_URL` is unset, the script validates that the Pages output directory exists and writes a placeholder summary. The real scan runs against a deployed URL via `@ariada-org/cli`.

## Worker variant

`worker/index.js` accepts a POST body with `url` and calls the hosted scan API using `ARIADA_API_TOKEN` as a managed Cloudflare secret.

## Local validation

```bash
shellcheck build-step.sh
taplo lint wrangler.example.toml
node scripts/validate-cloudflare.mjs
ARIADA_OUTPUT_DIR=fixtures/dist ARIADA_REPORT_DIR=ariada-output ./build-step.sh
```

## Publication blocker

A live Pages/Workers deployment requires a Cloudflare account and `CF_API_TOKEN`. Do not run bulk inference or hosted scans on a shared token.
