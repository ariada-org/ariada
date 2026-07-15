# Ariada Backstage Plugin

This stream is a Backstage frontend plugin surface for Ariada accessibility findings. It displays scan output from a hosted API or CI-produced report; it does not run a scanner.

Official source checked: https://backstage.io/docs/frontend-system/building-plugins/index/, https://backstage.io/docs/tooling/package-metadata/, and https://backstage.io/docs/tutorials/package-role-migration/

The current package ships the stable metadata and card-rendering contract. A live Backstage app can wrap `renderFindingsCard` in the host design system and fetch the same summary payload by catalog entity.

## Local validation

```bash
pnpm exec tsc -p integrations/backstage-ariada/tsconfig.json
pnpm exec eslint integrations/backstage-ariada/src integrations/backstage-ariada/tests
pnpm exec vitest run integrations/backstage-ariada/tests/card.test.ts
node integrations/backstage-ariada/scripts/validate-backstage.mjs
```

## Host blocker

Running inside a live Backstage app requires `@backstage/create-app` output and host app wiring. That is a founder/platform-owner step; this package provides the plugin metadata and tested findings-card contract.
