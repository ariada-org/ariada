<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Docusaurus Plugin

Docusaurus plugin that uses `postBuild` to scan the generated static output with
Ariada.

Official contract checked during implementation:

- Docusaurus plugins are modules with lifecycle methods.
  Source: https://docusaurus.io/docs/api/plugin-methods
- `postBuild` is the post-processing lifecycle for generated files.
  Source: https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis

```js
export default {
  plugins: [['@ariada-org/docusaurus-plugin', { failOn: 'serious' }]],
};
```

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
