// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/command.js` and `dist/command.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the value is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// One line in its own module because both sides need it and neither may import
// the other: the browser half runs in a page and the plugin half runs in the
// test runner's process. A shared constant is the whole of what they agree on,
// and putting it anywhere else would drag one side's imports into the other.

export const LIT_ARIADA_COMMAND = 'lit-ariada:scan';
