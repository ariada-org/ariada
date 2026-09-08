#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js` and `dist/bin.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The whole result is written out, not a summary of it, because the caller here
// is a build step whose log is the only record anyone will have afterwards.
//
// A failure before the gate is reached exits 3 and says so as one line of
// machine-readable diagnostics — distinct from the gate's own 0 and 1, so a
// broken run can never be mistaken for a clean page.

import { HELP_TEXT, loadConfig } from "./config.js";
import { runAmplifyIntegration } from "./integration.js";

async function main(): Promise<void> {
  try {
    const loaded = await loadConfig(process.argv.slice(2));
    if (loaded.help) {
      process.stdout.write(HELP_TEXT);
      return;
    }
    const result = await runAmplifyIntegration(loaded.config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.decision.processExitCode;
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${JSON.stringify({ level: "error", code: "E_AMPLIFY_INTEGRATION", message })}\n`,
    );
    process.exitCode = 3;
  }
}

void main();

