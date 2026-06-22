# Ariada Vercel Marketplace Integration

This package is the marketplace-grade Vercel integration stream. It is distinct from earlier Vercel application packages: it models a Vercel Checks integration that receives `deployment.ready`, calls the hosted Ariada scan surface, and posts a deployment check payload.

Official source checked: https://vercel.com/docs/integrations, https://vercel.com/docs/checks/creating-checks, and https://vercel.com/docs/checks/checks-api

The implementation deliberately does not embed a scanner. `src/handler.ts` builds hosted scan requests and Vercel Check payloads only.

## Local validation

```bash
pnpm exec tsc -p integrations/vercel-ariada/tsconfig.json
pnpm exec eslint integrations/vercel-ariada/src integrations/vercel-ariada/tests
pnpm exec vitest run integrations/vercel-ariada/tests/handler.test.ts
node integrations/vercel-ariada/scripts/validate-vercel.mjs
```

## Publication blocker

Marketplace registration and a live Vercel Check require a Vercel team, OAuth/integration registration, and production credentials. That is a founder/listing step.
