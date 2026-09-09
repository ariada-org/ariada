// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The executor is the only value this package exports. Everything else it
// offers is a shape: what a workspace may configure, and what a run gives back.

export { default as a11yExecutor } from './executors/a11y/executor.js';
export type { A11yExecutorResult, A11yExecutorSchema } from './executors/a11y/schema.js';
export type { InitGeneratorSchema } from './generators/init/schema.js';
