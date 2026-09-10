// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// the rebuild check.
//
// A PRIVATE ADDRESS IS REFUSED UNLESS ASKED FOR IN WORDS, AND THE CHECK IS
// DELIBERATELY BROAD. Loopback, link-local, every private range, the unique-local
// prefixes, and the whole of 0.0.0.0/8 — because a release gate pointed at a
// developer's own machine passes every time and means nothing, and the mistake
// is easy: the address is usually in an environment variable somebody else set.
// Asking for it explicitly is one flag; discovering months later that the gate
// has been scanning localhost is not recoverable.
//
// Settings come from the environment or the command line, and the command line
// wins. That way a pipeline sets the defaults once and a person can override one
// of them for a single run without editing anything.
//
// Exit codes carry three different meanings: the page's verdict passes through,
// a broken scanner keeps its own code when it is above one, and everything else
// — a bad command line, a missing target, an unreadable report — is two.

import { resolve } from "node:path";

import { appendChangelogSummary } from "./changelog.js";
import { AriadaExecutionError, readGateReport, runReleaseGate } from "./gate.js";
import { ARIADA_SEVERITIES, } from "./types.js";
import type { AriadaSeverity, BrowserName, GateOptions } from "./types.js";

const VERSION = "0.1.0";
const BROWSERS = ["chromium", "firefox", "webkit"] as const;

const HELP = `Usage: changesets-ariada <command> [options]

Commands:
  gate      Run the installed Ariada CLI and block release on threshold findings
  append    Append a gate summary to a generated changelog
  version   Print the integration version

Gate options:
  --url <http(s) URL>                  Target (or ARIADA_URL)
  --severity-threshold <level>         minor|moderate|serious|critical (default: serious)
  --browser <name>                     chromium|firefox|webkit (default: chromium)
  --timeout-ms <milliseconds>          Per-URL timeout (default: 30000)
  --output-dir <path>                  Ariada output directory (default: .ariada/scan)
  --report <path>                      Gate report (default: .ariada/release-gate.json)
  --changeset-dir <path>               Changesets directory (default: .changeset)
  --require-changeset                  Require at least one pending changeset
  --allow-private                      Permit an explicit loopback/private literal target
  --changelog <path>                   Optionally append the result after the scan

Append options:
  --report <path> --changelog <path>
`;

function valueAfter(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function parseSeverity(value: string): AriadaSeverity {
  if (!ARIADA_SEVERITIES.includes(value as AriadaSeverity)) {
    throw new Error(`Unsupported severity threshold: ${value}`);
  }
  return value as AriadaSeverity;
}

function parseBrowser(value: string): BrowserName {
  if (!BROWSERS.includes(value as BrowserName)) throw new Error(`Unsupported browser: ${value}`);
  return value as BrowserName;
}

function parseTimeout(value: string): number {
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120_000) {
    throw new Error("--timeout-ms must be an integer from 1 to 120000");
  }
  return timeout;
}

function isPrivateLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "::1") return true;
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;
  return (first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168));
}

export function parseGateArguments(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): GateOptions {
  let url = env.ARIADA_URL;
  let severityThreshold = parseSeverity(env.ARIADA_SEVERITY_THRESHOLD ?? "serious");
  let browser = parseBrowser(env.ARIADA_BROWSER ?? "chromium");
  let timeoutMs = parseTimeout(env.ARIADA_TIMEOUT_MS ?? "30000");
  let outputDirectory = env.ARIADA_OUTPUT_DIR ?? ".ariada/scan";
  let reportPath = env.ARIADA_RELEASE_REPORT ?? ".ariada/release-gate.json";
  let changesetDirectory = env.CHANGESET_DIR ?? ".changeset";
  let changelogPath: string | undefined;
  let requireChangeset = false;
  let allowPrivate = false;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    switch (flag) {
      case "--url":
        url = valueAfter(args, index, flag);
        index += 1;
        break;
      case "--severity-threshold":
        severityThreshold = parseSeverity(valueAfter(args, index, flag));
        index += 1;
        break;
      case "--browser":
        browser = parseBrowser(valueAfter(args, index, flag));
        index += 1;
        break;
      case "--timeout-ms":
        timeoutMs = parseTimeout(valueAfter(args, index, flag));
        index += 1;
        break;
      case "--output-dir":
        outputDirectory = valueAfter(args, index, flag);
        index += 1;
        break;
      case "--report":
        reportPath = valueAfter(args, index, flag);
        index += 1;
        break;
      case "--changeset-dir":
        changesetDirectory = valueAfter(args, index, flag);
        index += 1;
        break;
      case "--changelog":
        changelogPath = valueAfter(args, index, flag);
        index += 1;
        break;
      case "--require-changeset":
        requireChangeset = true;
        break;
      case "--allow-private":
        allowPrivate = true;
        break;
      default:
        throw new Error(`Unknown gate option: ${flag}`);
    }
  }
  if (!url) throw new Error("A target is required via --url or ARIADA_URL");
  const target = new URL(url);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Target must use http: or https:");
  }
  if (isPrivateLiteral(target.hostname) && !allowPrivate) {
    throw new Error("Loopback/private literal targets require --allow-private");
  }
  return {
    url: target.href,
    severityThreshold,
    browser,
    timeoutMs,
    outputDirectory,
    reportPath,
    changesetDirectory,
    requireChangeset,
    allowPrivate,
    ...(changelogPath === undefined ? {} : { changelogPath }),
    cwd: resolve(cwd),
  };
}

function parseAppendArguments(args: readonly string[]): { report: string; changelog: string } {
  let report: string | undefined;
  let changelog: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--report") report = valueAfter(args, index++, flag);
    else if (flag === "--changelog") changelog = valueAfter(args, index++, flag);
    else throw new Error(`Unknown append option: ${flag}`);
  }
  if (!report || !changelog) throw new Error("append requires --report and --changelog");
  return { report, changelog };
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  try {
    const [command, ...rest] = args;
    if (!command || command === "--help" || command === "-h" || command === "help") {
      process.stdout.write(HELP);
      return 0;
    }
    if (command === "--version" || command === "-V" || command === "version") {
      process.stdout.write(`${VERSION}\n`);
      return 0;
    }
    if (command === "append") {
      const options = parseAppendArguments(rest);
      const report = await readGateReport(resolve(options.report));
      const appended = await appendChangelogSummary(resolve(options.changelog), report);
      process.stdout.write(`${JSON.stringify({ appended, changelog: options.changelog })}\n`);
      return 0;
    }
    if (command !== "gate") throw new Error(`Unknown command: ${command}`);
    const execution = await runReleaseGate(parseGateArguments(rest));
    if (execution.diagnostics.trim()) process.stderr.write(execution.diagnostics);
    process.stdout.write(`${JSON.stringify(execution.report)}\n`);
    return execution.report.ariadaExitCode;
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`changesets-ariada: ${message}\n`);
    return error instanceof AriadaExecutionError && error.exitCode > 1 ? error.exitCode : 2;
  }
}
