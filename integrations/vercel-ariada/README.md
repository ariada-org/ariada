# Ariada Vercel Marketplace Integration

This package is the marketplace-grade Vercel integration stream. It is distinct from earlier Vercel application packages: it models a Vercel Checks integration that receives `deployment.ready`, calls the hosted Ariada scan surface, and posts a deployment check payload.

Official source checked: https://vercel.com/docs/integrations, https://vercel.com/docs/checks/creating-checks, and https://vercel.com/docs/checks/checks-api

The implementation deliberately does not embed a scanner — the scan itself runs on the hosted Ariada scan surface, injected into the flow as a callback. This package owns everything around that call: verifying the inbound webhook is genuinely from Vercel, shaping the scan request, shaping the Vercel Check payload, and making the two Vercel Checks API calls that create and update the check.

## Wired flow

`src/integration.ts` exports `runVercelCheckIntegration(input)`, the full path from an inbound webhook to a completed Vercel check:

1. **Verify** — `src/signature.ts` checks the `x-vercel-signature` request header (HMAC-SHA1 of the raw body, keyed with the integration's webhook secret) using a constant-time comparison. An unverified request throws `WebhookAuthError` before anything else runs — no unauthenticated request reaches the scanner.
2. **Filter** — only `deployment.ready` events proceed (the manifest declares this as the sole subscribed event); anything else returns `null` without side effects.
3. **Build the scan request** — `src/handler.ts#buildScanRequest` turns the deployment event into a normalised, HTTPS-qualified scan request.
4. **Create the check** — `src/vercel-checks-client.ts#createVercelCheck` opens a check in the `running` state via `POST /v1/deployments/{deploymentId}/checks`, so the check is visible in the Vercel dashboard while the scan is in flight.
5. **Run the hosted scan** — the caller-supplied `runHostedScan(request)` callback (kept as an injected dependency so this package has no direct network dependency of its own beyond the Vercel API).
6. **Build the check payload** — `src/handler.ts#buildCheckPayload` turns the scan summary into a pass/fail Vercel Check payload.
7. **Update the check** — `src/vercel-checks-client.ts#updateVercelCheck` closes the check via `PATCH /v1/deployments/{deploymentId}/checks/{checkId}` with the final conclusion.

Every HTTP call (both to the Vercel Checks API) goes through an injectable `fetch`-shaped function (`FetchLike`), so the whole flow is unit-tested end to end without ever making a real network call — see `tests/integration.test.mjs`.

## Local validation

```bash
pnpm --filter @ariada-integrations/vercel-ariada typecheck
pnpm --filter @ariada-integrations/vercel-ariada lint
pnpm --filter @ariada-integrations/vercel-ariada test
pnpm --filter @ariada-integrations/vercel-ariada validate
```

## Publication blocker (human-gated)

Everything above is verified locally against fakes. What remains and requires a human with account access:

- **Vercel Marketplace listing** — registering this as an installable Vercel Integration requires a Vercel team account and the Marketplace listing/review process.
- **OAuth/integration registration** — obtaining a real client ID + webhook secret from Vercel's integration console.
- **Production `checks:write` API token** — a live team-scoped Vercel API token for `createVercelCheck` / `updateVercelCheck` to call the real `api.vercel.com`.
- **Hosted Ariada scan surface** — `runHostedScan` is intentionally left as an injected callback; wiring it to a real scan backend (and deploying that backend) is a separate, hosted-infrastructure concern outside this package.

No code change unlocks these — they are account/infrastructure steps, not implementation gaps.
