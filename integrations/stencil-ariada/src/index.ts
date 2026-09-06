// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the body is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

export { stencilAriada, runStencilAriada } from './output-target.js';
export { normalizeOptions } from './config.js';
export { parseAriadaScanJson, hasFindingAtOrAbove } from './report.js';
export type { AriadaFinding, AriadaSeverity, ComponentAriadaReport, ComponentUsage, NormalizedStencilAriadaOptions, ParsedAriadaScan, StencilAriadaOptions, StencilAriadaReport, } from './types.js';
