# Ariada VitePress Integration

`@ariada-org/vitepress-ariada` is a thin VitePress build hook over the shared
`@ariada-org/cli`. It serves the built `.vitepress/dist` output locally, invokes
`ariada scan`, reads the CLI report, and fails the VitePress build when findings
meet the configured threshold.

```ts
import { defineConfig } from 'vitepress';
import { withAriada } from '@ariada-org/vitepress-ariada';

export default withAriada(
  defineConfig({
    title: 'Docs',
  }),
  {
    domains: ['accessibility', 'privacy', 'security'],
    severityThreshold: 'moderate',
  },
);
```

The integration does not implement accessibility rules. Scanner logic stays in
`@ariada-org/cli`; this package only adapts VitePress build output to that CLI.

## Commands

```sh
pnpm build
pnpm typecheck
pnpm test
```

The fixture test builds a minimal VitePress site when `vitepress` is installed.
If the dependency is unavailable, the test records the host limitation and skips
only that e2e path; mocked CLI unit tests still cover command construction,
report parsing, and gate behavior.
