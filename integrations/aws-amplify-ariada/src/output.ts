// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/output.js` and `dist/output.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// EVERY FIELD IS CHECKED, THOUGH OUR OWN SCANNER WROTE THE FILE. The file is
// read off a disk this process does not own, at a path the caller chose, and
// what comes back is handed to a gate that decides whether a build proceeds.
// Trusting it because of who wrote it means a truncated or half-written file
// reads as a clean page.
//
// A count must be a non-negative whole number and a name a non-empty string, so
// the two ways a JSON number goes wrong — a fraction and a negative — are both
// refused rather than carried into arithmetic. The optional identifier is
// omitted rather than set to undefined when absent, so the reconstructed object
// has the same shape as the one that was written.

import type { AriadaScanJson } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(object: Record<string, unknown>, key: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function countField(object: Record<string, unknown>, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return value;
}

export function parseAriadaScanJson(source: string): AriadaScanJson {
  let value: unknown;
  try {
    value = JSON.parse(source);
  }
  catch (error) {
    throw new Error(
      `Invalid Ariada scan JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(value)) throw new Error("Ariada scan JSON must be an object");
  const summary = value["summary"];
  const report = value["report"];
  if (!isRecord(summary)) throw new Error("summary must be an object");
  if (!isRecord(report)) throw new Error("report must be an object");
  const byImpact = summary["byImpact"];
  if (!isRecord(byImpact)) throw new Error("summary.byImpact must be an object");
  const exitCode = value["exitCode"];
  if (exitCode !== 0 && exitCode !== 1) {
    throw new Error("exitCode must be 0 or 1");
  }
  const counts = {
    critical: countField(byImpact, "critical"),
    serious: countField(byImpact, "serious"),
    moderate: countField(byImpact, "moderate"),
    minor: countField(byImpact, "minor"),
  };
  const scanId = value["scanId"];
  if (scanId !== undefined && typeof scanId !== "string") {
    throw new Error("scanId must be a string when present");
  }
  return {
    $schema: stringField(value, "$schema"),
    url: stringField(value, "url"),
    ...(scanId === undefined ? {} : { scanId }),
    startedAt: stringField(value, "startedAt"),
    completedAt: stringField(value, "completedAt"),
    durationMs: countField(value, "durationMs"),
    summary: {
      total: countField(summary, "total"),
      byImpact: counts,
    },
    report,
    exitCode,
  };
}
