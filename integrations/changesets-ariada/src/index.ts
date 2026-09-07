// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the body is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Everything the gate is made of is exported, not only the gate. The parts that
// can be tested without a browser — reading a report, finding pending change
// notes, formatting a changelog line, parsing a command line — are the parts
// worth having a name for.

export { appendChangelogSummary, formatChangelogSummary } from "./changelog.js";
export { findPendingChangesets } from "./changesets.js";
export { main, parseGateArguments } from "./cli.js";
export { AriadaExecutionError, buildAriadaArguments, readGateReport, resolveInstalledAriadaCli, runReleaseGate, writeGateReport, } from "./gate.js";
export { parseAriadaSummary } from "./report.js";
export type { AriadaSeverity, AriadaSummary, BrowserName, ChangesetSummary, GateExecution, GateOptions, GateReport, SeverityCounts, } from "./types.js";
