// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/changelog.js` and `dist/changelog.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The line is written into the changelog once. A gate can run several times for
// one release — a rerun, a retry, a second pipeline — and appending each time
// would fill a release's notes with the same sentence. So the existing lines are
// read first and an exact repeat is refused, which is what the boolean return
// says.
//
// The file's permissions are read and reused when it already exists, because a
// changelog is often checked in with particular modes and rewriting it should
// not quietly change them. It is written beside itself and renamed into place,
// so a reader never meets half a changelog.

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { GateReport } from "./types.js";

export function formatChangelogSummary(report: GateReport): string {
  const rules = report.findings.triggeringRuleIds.join(", ") || "none";
  return `- Accessibility release gate: ${report.status.toUpperCase()} (${report.findings.triggering} finding(s) at or above ${report.threshold}; rules: ${rules}).`;
}

export async function appendChangelogSummary(path: string, report: GateReport): Promise<boolean> {
  const line = formatChangelogSummary(report);
  let current = "# Changelog\n";
  let mode = 0o644;
  try {
    current = await readFile(path, "utf8");
    mode = (await stat(path)).mode;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (current.split(/\r?\n/).includes(line)) return false;
  const separator = current.endsWith("\n") ? "" : "\n";
  const next = `${current}${separator}\n${line}\n`;
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(temporary, next, { encoding: "utf8", mode });
  await rename(temporary, path);
  return true;
}
