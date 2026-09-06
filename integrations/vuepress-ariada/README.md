# Ariada VuePress Plugin

`vuepress-plugin-ariada` is a thin VuePress 2 plugin over the shared
`@ariada-org/cli`. It waits for VuePress to generate `.vuepress/dist`, serves that
static output locally, runs `ariada scan` against the rendered site, and records
CLI artifacts for review.

It does not implement accessibility rules and does not parse VuePress internals.
All scanning remains in the shared Ariada CLI and engine.

## Install

```sh
pnpm add -D vuepress-plugin-ariada @ariada-org/cli
```

## VuePress config

```js
import ariadaVuePress from 'vuepress-plugin-ariada';

export default {
  plugins: [
    ariadaVuePress({
      domains: ['accessibility'],
      failOnViolation: true,
      reportDir: 'scan-evidence',
      severityThreshold: 'moderate',
    }),
  ],
};
```

## Options

| Option | Default | Purpose |
| ------ | ------- | ------- |
| `outputDir` | `app.dir.dest` or `.vuepress/dist` | Generated VuePress directory to serve and scan. |
| `reportDir` | `ariada-vuepress-report` | Directory for `command.log`, `command.exit`, and `ariada-output/`. |
| `domains` | `['accessibility']` | Ariada CLI domains passed to `--domains`. |
| `format` | `both` | Ariada CLI output format. |
| `severityThreshold` | `moderate` | Minimum severity that makes the CLI exit non-zero. |
| `failOnViolation` | `true` | Throws from `onGenerated` when Ariada exits with violations. |
| `cliCommand` | `ariada` | CLI binary name when the package is installed. |
| `cliPath` | unset | Absolute path to a local CLI JS file for repo fixtures. |

## Local verification

```sh
pnpm --dir integrations/vuepress-ariada typecheck
pnpm --dir integrations/vuepress-ariada lint
pnpm --dir integrations/vuepress-ariada test
pnpm --dir integrations/vuepress-ariada build
```

There is no evidence command here. The script it would have run is not in this
package, so the command could only ever fail; the other integrations that do have
one keep it. Producing evidence against a real VuePress build is worth having and
is not written yet.
