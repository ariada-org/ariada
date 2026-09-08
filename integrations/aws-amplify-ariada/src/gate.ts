// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/gate.js` and `dist/gate.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE DECISION SEPARATES TWO THINGS THE EXIT CODE ALONE CONFLATES: whether the
// page has accessibility problems, and whether the scan worked. Zero and one are
// answers — clean and violations. Anything else means nothing was measured, and
// it becomes `error`, never a quiet pass.
//
// It also refuses to believe a report that disagrees with the run that produced
// it. If the scanner exits one and its own report says zero, something is being
// read that does not belong to this run, and that is an error rather than a
// verdict.
//
// `wouldBlock` is recorded separately from what the process actually returns, so
// report-only mode still says plainly that it would have blocked. A mode that
// merely returns zero teaches nobody anything; one that returns zero while
// stating what it found is a step towards turning the gate on.
//
// An error keeps the scanner's own exit code when it is one of the ones we
// recognise, and becomes 3 otherwise. Passing through an unrecognised number
// would let a signal or a shell failure masquerade as a diagnosis.

import type { AriadaScanJson, GateDecision, GateMode } from "./types.js";

function gateErrorExitCode(cliExitCode: number): number {
  return cliExitCode >= 2 && cliExitCode <= 5 ? cliExitCode : 3;
}

export function decideGate(
  mode: GateMode,
  cliExitCode: number,
  scan: AriadaScanJson | null,
  integrationError?: string,
): GateDecision {
  let outcome: GateDecision["outcome"];
  let reason: string;
  let gateExitCode: number;
  if (integrationError !== undefined) {
    outcome = "error";
    reason = integrationError;
    gateExitCode = gateErrorExitCode(cliExitCode);
  }
  else if (cliExitCode !== 0 && cliExitCode !== 1) {
    outcome = "error";
    reason = `@ariada-org/cli exited with code ${cliExitCode}`;
    gateExitCode = gateErrorExitCode(cliExitCode);
  }
  else if (scan === null) {
    outcome = "error";
    reason = "@ariada-org/cli did not produce a parseable scan.json";
    gateExitCode = 3;
  }
  else if (scan.exitCode !== cliExitCode) {
    outcome = "error";
    reason = `CLI exit code ${cliExitCode} does not match scan.json exitCode ${scan.exitCode}`;
    gateExitCode = 3;
  }
  else if (scan.exitCode === 1) {
    outcome = "violations";
    reason = `${scan.summary.total} violation(s) met the configured severity threshold`;
    gateExitCode = 1;
  }
  else {
    outcome = "pass";
    reason = "No violations met the configured severity threshold";
    gateExitCode = 0;
  }
  return {
    mode,
    outcome,
    wouldBlock: outcome !== "pass",
    processExitCode: mode === "report-only" ? 0 : gateExitCode,
    reason,
  };
}
