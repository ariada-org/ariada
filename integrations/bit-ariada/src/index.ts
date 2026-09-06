// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the body is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The parts that need neither a browser nor a workspace are exported by name —
// normalising options, resolving a path inside a capsule, parsing a scan, asking
// whether anything reached a severity. Those are the parts that can be tested.

export { normalizeOptions, pathsOverlap, renderedTargetFor, resolveInside } from './config.js';
export { emptySeverityCounts, hasFindingAtOrAbove, parseAriadaScanJson } from './report.js';
export { scanRenderedPage } from './scanner.js';
export { startStaticServer, type StaticServer } from './server.js';
export { AriadaTask, createAriadaTask, type AriadaTaskRuntime } from './task.js';
export { ARIADA_SEVERITIES, type AriadaBitOptions, type AriadaFinding, type AriadaSeverity, type BitComponentAriadaReport, type NormalizedAriadaBitOptions, type NormalizedRenderedPageTarget, type ParsedAriadaScan, type RenderedPageTarget, } from './types.js';
