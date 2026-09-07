// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/gate.js` and `dist/gate.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE CHANGE NOTE IS CHECKED BEFORE THE SCAN, NOT AFTER. A release with no
// pending note is going to be refused either way, and the scan is the expensive
// part — a browser, a page load, a full analysis. Refusing first costs a
// directory listing.
//
// The previous scan artifact is deleted before the run rather than overwritten.
// If the scanner dies without writing one, reading the old file would gate this
// release on the previous release's findings, and nothing would say so.
//
// A failing page and a broken scanner are different answers, and the error type
// carries the difference: exit 0 or 1 is the page's verdict, anything else
// becomes an execution error with the scanner's own diagnostics attached and its
// exit code preserved.
//
// The browser download is disabled for the child, because installing software
// during somebody's release is not this gate's business.

import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { appendChangelogSummary } from "./changelog.js";
import { findPendingChangesets } from "./changesets.js";
import { runProcess } from "./process.js";
import { parseAriadaSummary } from "./report.js";
import type { GateExecution, GateOptions, GateReport } from "./types.js";

export class AriadaExecutionError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "AriadaExecutionError";
    this.exitCode = exitCode;
  }
}

export function buildAriadaArguments(options: GateOptions): string[] {
  return [
    "scan",
    options.url,
    "--format",
    "json",
    "--severity-threshold",
    options.severityThreshold,
    "--browser",
    options.browser,
    "--timeout-ms",
    String(options.timeoutMs),
    "--output-dir",
    resolve(options.cwd, options.outputDirectory),
  ];
}

export async function resolveInstalledAriadaCli(): Promise<string> {
  const apiEntry = fileURLToPath(import.meta.resolve("@ariada-org/cli"));
  const cliEntry = join(dirname(apiEntry), "bin.js");
  await access(cliEntry);
  return cliEntry;
}

export async function writeGateReport(path: string, report: GateReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function readGateReport(path: string): Promise<GateReport> {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (value.schemaVersion !== "1.0" ||
    (value.status !== "pass" && value.status !== "fail") ||
    !value.findings ||
    !value.changesets) {
    throw new Error("Invalid changesets-ariada gate report");
  }
  return value;
}

export async function runReleaseGate(options: GateOptions): Promise<GateExecution> {
  const changesetDirectory = resolve(options.cwd, options.changesetDirectory);
  const pending = await findPendingChangesets(changesetDirectory);
  if (options.requireChangeset && pending.length === 0) {
    throw new Error(`No pending Changesets files found in ${options.changesetDirectory}`);
  }
  const cliEntry = await resolveInstalledAriadaCli();
  const scanArtifact = resolve(options.cwd, options.outputDirectory, "scan.json");
  await rm(scanArtifact, { force: true });
  const child = await runProcess(process.execPath, [cliEntry, ...buildAriadaArguments(options)], {
    cwd: options.cwd,
    env: {
      ...process.env,
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
    },
  });
  if (child.exitCode !== 0 && child.exitCode !== 1) {
    const detail = child.stderr.trim() || child.stdout.trim() || "no diagnostics";
    throw new AriadaExecutionError(`Ariada CLI failed operationally: ${detail}`, child.exitCode);
  }
  const summary = parseAriadaSummary(await readFile(scanArtifact, "utf8"), child.exitCode, options.severityThreshold);
  const report: GateReport = {
    schemaVersion: "1.0",
    status: child.exitCode === 0 ? "pass" : "fail",
    target: options.url,
    threshold: options.severityThreshold,
    ariadaExitCode: child.exitCode,
    findings: summary,
    changesets: {
      required: options.requireChangeset,
      directory: options.changesetDirectory,
      pending: pending.map((entry) => basename(entry)),
    },
  };
  await writeGateReport(resolve(options.cwd, options.reportPath), report);
  if (options.changelogPath) {
    await appendChangelogSummary(resolve(options.cwd, options.changelogPath), report);
  }
  return { report, diagnostics: child.stderr };
}
