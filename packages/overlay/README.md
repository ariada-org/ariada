<!-- SPDX-License-Identifier: Apache-2.0 -->
# @ariada-org/overlay

A fully abstract in-page overlay for accessibility findings. The engine only
resolves findings (`{selector, severity, message}`) to live element rectangles
and keeps them attached on scroll/resize. **What is drawn is a pluggable
painter** — you register your own:

- `box` — outlined boxes per element (severity-coloured)
- `line` — connector lines from a side rail to each block
- a **mascot** — a character that flies element to element; the glyph is a
  parameter, so Dracula (`🧛`), Thumbelina (`🧚`), or any future
  visual is a one-line `makeMascotPainter({ glyph })`.

```js
import { createOverlay, registerPainter } from '@ariada-org/overlay';
import '@ariada-org/overlay/painters';         // box · line · dracula · thumbelina
const ov = createOverlay(document);
ov.show(findings, 'dracula');                  // by id
ov.focus(2);                                    // fly to the 3rd finding
// drop in anything: registerPainter({ id:'mine', paint(anchors, layer){ ... } })
```

Works in any page context — a browser-extension content script (live site),
a DOM snapshot, or a proxied page. See `demo.html`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
