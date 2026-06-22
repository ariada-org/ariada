<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Eleventy Plugin

Eleventy plugin that listens for `eleventy.after` and scans the generated
`_site/` output with Ariada.

Official contract checked during implementation:

- Eleventy plugins are passed to `addPlugin`.
  Source: https://www.11ty.dev/docs/create-plugin/
- `eleventy.after` runs when Eleventy finishes building.
  Source: https://www.11ty.dev/docs/events/

```js
import ariadaEleventy from '@ariada-org/eleventy-plugin';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(ariadaEleventy, { failOn: 'serious' });
}
```
