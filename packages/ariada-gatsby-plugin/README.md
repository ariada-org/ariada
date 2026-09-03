<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Gatsby Plugin

Gatsby plugin that runs after build and scans the generated `public/` HTML with
Ariada. It reuses `@ariada-org/vite-plugin` static HTML scanning.

Official contract checked during implementation:

- Gatsby plugins can export Node APIs from `gatsby-node.js`; those APIs respond
  to build lifecycle events.
  Source: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-node/

```js
export default {
  plugins: [
    {
      resolve: '@ariada-org/gatsby-plugin',
      options: { failOn: 'serious' },
    },
  ],
};
```

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
