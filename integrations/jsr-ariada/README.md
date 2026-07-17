# Ariada JSR Publish Wrapper

This package is the Pack 8 JSR stream. It is config-only and deliberately small: it proves the Ariada public surface can be represented as a JSR package while scan execution remains in `@ariada-org/cli`.

Official source checked: https://jsr.io/docs/publishing-packages and https://docs.deno.com/runtime/reference/cli/publish/

The PRD allowed either a small wrapper/config package or adding JSR config to one existing package. This workspace keeps it under `integrations/jsr-ariada/` so Pack 8 does not touch root workspace registration or lockfiles.

## Local validation

```bash
pnpm exec tsc -p integrations/jsr-ariada/tsconfig.json
pnpm exec eslint integrations/jsr-ariada/src integrations/jsr-ariada/test integrations/jsr-ariada/scripts
pnpm exec vitest run integrations/jsr-ariada/test/mod.test.ts
node integrations/jsr-ariada/scripts/validate-jsr.mjs
deno publish --dry-run --config integrations/jsr-ariada/jsr.json
```

## Publication blocker

The actual `jsr publish` needs JSR package ownership and auth through GitHub OIDC or a token. That is a founder/listing step.
