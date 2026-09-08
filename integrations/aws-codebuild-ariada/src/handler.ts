// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/handler.js` and `dist/handler.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE EVENT IS UNTRUSTED AND IS TREATED AS SUCH. This runs where anything that
// can invoke the function can choose the address, so the address is checked
// rather than passed through: a length ceiling, a real parse, http or https
// only, no credentials embedded in it, and — when the deployment names an
// allow-list — a host that appears on it. A scanner that fetches whatever it is
// told is a request-forger with a browser attached.
//
// THE REPORT COMING BACK IS UNTRUSTED TOO, AND FOR A LESS OBVIOUS REASON. It was
// written by our own scanner, so the temptation is to parse and return it. But
// the file is read off a disk this function does not exclusively own, and the
// caller receives whatever is in it under our name. So the schema is named
// exactly, every field the report promises is checked for the type it promises,
// and the URL and the exit code inside it must agree with the run that produced
// them. A report about a different address is not this scan's result.
//
// A BROKEN RUN IS NOT A FAILED GATE. Exit codes 0 and 1 are answers — clean and
// violations. Anything else is the scanner not having reached an answer, and it
// raises rather than returning `passed: false`, because a caller that reads a
// crash as a passing gate learns nothing and stops asking.
//
// The scanner's own error is looked for from the last line of its diagnostics
// backwards, since the useful line is the last one written; non-JSON noise on the
// way is stepped over rather than treated as a parse failure. What comes out
// keeps the scanner's own code and detail, so the caller can tell a timeout from
// a bad address without reading prose.

import { createCliRunner } from "./cli-runner.js";
import {
  type AriadaScanEnvelope,
  type CliRunner,
  type CliRunResult,
  type CliScanRequest,
  type LambdaScanReport,
  SEVERITY_THRESHOLDS,
  type SeverityThreshold,
} from "./types.js";

const ARIADA_SCAN_SCHEMA = "https://ariada.org/schemas/cli-scan.v1.json";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_URL_LENGTH = 2_048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, property: string): string {
  const value = record[property];
  if (typeof value !== "string") {
    throw new Error(`Ariada scan report property ${property} must be a string`);
  }
  return value;
}

function requireNonNegativeNumber(record: Record<string, unknown>, property: string): number {
  const value = record[property];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Ariada scan report property ${property} must be a non-negative number`);
  }
  return value;
}

function parseEnvelope(value: unknown): AriadaScanEnvelope {
  if (!isRecord(value)) {
    throw new Error("Ariada CLI did not produce a JSON scan report");
  }
  if (value.$schema !== ARIADA_SCAN_SCHEMA) {
    throw new Error("Ariada CLI returned an unsupported scan report schema");
  }
  requireString(value, "url");
  requireString(value, "startedAt");
  requireString(value, "completedAt");
  requireNonNegativeNumber(value, "durationMs");
  if (value.scanId !== undefined && typeof value.scanId !== "string") {
    throw new Error("Ariada scan report property scanId must be a string");
  }
  if (typeof value.exitCode !== "number" || !Number.isInteger(value.exitCode)) {
    throw new Error("Ariada scan report property exitCode must be an integer");
  }
  if (!("report" in value)) {
    throw new Error("Ariada scan report is missing its report payload");
  }
  if (!isRecord(value.summary)) {
    throw new Error("Ariada scan report is missing its summary");
  }
  requireNonNegativeNumber(value.summary, "total");
  if (!isRecord(value.summary.byImpact)) {
    throw new Error("Ariada scan report is missing summary.byImpact");
  }
  for (const impact of ["critical", "serious", "moderate", "minor"]) {
    requireNonNegativeNumber(value.summary.byImpact, impact);
  }
  return value as unknown as AriadaScanEnvelope;
}

function parseCliError(result: CliRunResult): {
  code: string | undefined;
  details: unknown;
  message: string;
} {
  const lines = result.stderr.trim().split("\n").reverse();
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed) && typeof parsed.message === "string") {
        return {
          code: typeof parsed.code === "string" ? parsed.code : undefined,
          details: parsed.details,
          message: parsed.message,
        };
      }
    }
    catch {
      // The CLI contract uses one-line JSON errors; ignore unrelated stderr.
    }
  }
  return {
    code: undefined,
    details: undefined,
    message:
      result.stderr.trim() ||
      result.stdout.trim() ||
      `Ariada CLI failed with exit code ${result.exitCode}`,
  };
}

export class AriadaCliError extends Error {
  readonly cliCode: string | undefined;
  readonly details: unknown;
  readonly exitCode: number;

  constructor(message: string, exitCode: number, cliCode: string | undefined, details: unknown) {
    super(message);
    this.name = "AriadaCliError";
    this.exitCode = exitCode;
    this.cliCode = cliCode;
    this.details = details;
  }
}

function parseSeverity(value: unknown): SeverityThreshold {
  if (
    typeof value !== "string" ||
    !SEVERITY_THRESHOLDS.some((threshold) => threshold === value)
  ) {
    throw new Error(`severityThreshold must be one of: ${SEVERITY_THRESHOLDS.join(", ")}`);
  }
  return value as SeverityThreshold;
}

function parseTimeout(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (
    typeof parsed !== "number" ||
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > MAX_TIMEOUT_MS
  ) {
    throw new Error(`timeoutMs must be an integer between 1 and ${MAX_TIMEOUT_MS}`);
  }
  return parsed;
}

function parseRequest(event: unknown, environment: NodeJS.ProcessEnv): CliScanRequest {
  if (!isRecord(event) || typeof event.url !== "string") {
    throw new Error("Lambda event must contain a string url property");
  }
  if (event.url.length === 0 || event.url.length > MAX_URL_LENGTH) {
    throw new Error(`url must contain between 1 and ${MAX_URL_LENGTH} characters`);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(event.url);
  }
  catch {
    throw new Error("url must be a valid http(s) URL");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("url must use http or https");
  }
  if (parsedUrl.username !== "" || parsedUrl.password !== "") {
    throw new Error("url must not include embedded credentials");
  }
  const allowedHosts = environment.ARIADA_ALLOWED_HOSTS;
  if (allowedHosts !== undefined && allowedHosts.trim() !== "") {
    const allowed = new Set(
      allowedHosts
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter((host) => host.length > 0),
    );
    if (!allowed.has(parsedUrl.hostname.toLowerCase())) {
      throw new Error(`url host is not present in ARIADA_ALLOWED_HOSTS`);
    }
  }
  const severityThreshold = parseSeverity(
    event.severityThreshold ??
      environment.ARIADA_SEVERITY_THRESHOLD ??
      "moderate",
  );
  const timeoutMs = parseTimeout(
    event.timeoutMs ?? environment.ARIADA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );
  return {
    url: event.url,
    severityThreshold,
    timeoutMs,
  };
}

export function mapCliResult(request: CliScanRequest, result: CliRunResult): LambdaScanReport {
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    const parsedError = parseCliError(result);
    throw new AriadaCliError(
      parsedError.message,
      result.exitCode,
      parsedError.code,
      parsedError.details,
    );
  }
  const envelope = parseEnvelope(result.envelope);
  if (envelope.url !== request.url) {
    throw new Error("Ariada scan report URL does not match the requested URL");
  }
  if (envelope.exitCode !== result.exitCode) {
    throw new Error("Ariada scan report exitCode does not match the CLI process exit code");
  }
  const exitCode = result.exitCode;
  const passed = exitCode === 0;
  return {
    schemaVersion: 1,
    integration: {
      name: "aws-codebuild-ariada",
      cliPackage: "@ariada-org/cli",
      cliVersion: "0.1.0",
    },
    target: { url: request.url },
    gate: {
      passed,
      outcome: passed ? "passed" : "violations",
      threshold: request.severityThreshold,
      exitCode,
    },
    summary: envelope.summary,
    ariada: envelope,
  };
}

export function createHandler(
  runner: CliRunner = createCliRunner(),
  environment: NodeJS.ProcessEnv = process.env,
): (event: unknown) => Promise<LambdaScanReport> {
  return async (event) => {
    const request = parseRequest(event, environment);
    const result = await runner(request);
    return mapCliResult(request, result);
  };
}

export const handler = createHandler();
