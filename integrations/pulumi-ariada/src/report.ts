import { scoreFromCounts } from "@ariada-org/core-engine/scoring";

import type { NormalizedScanResult, ViolationCounts } from "./types.js";
const CLI_SCAN_SCHEMA = "https://ariada.org/schemas/cli-scan.v1.json";
function invalid(message: string): Error {
    return new Error(`Invalid Ariada CLI scan JSON: ${message}`);
}
function recordAt(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw invalid(`${path} must be an object`);
    }
    return value as Record<string, unknown>;
}

function countAt(value: unknown, path: string): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw invalid(`${path} must be a non-negative safe integer`);
    }
    return value;
}
/**
 * Validates and normalizes the artifact emitted by @ariada-org/cli.
 * Scoring delegates to Ariada's locked scoreFromCounts implementation.
 */
export function parseScanJson(json: string): NormalizedScanResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw invalid(`document is not valid JSON (${detail})`);
    }
    const envelope = recordAt(parsed, "root");
    if (envelope["$schema"] !== CLI_SCAN_SCHEMA) {
        throw invalid(`$schema must be ${CLI_SCAN_SCHEMA}`);
    }
    if (typeof envelope["url"] !== "string" || envelope["url"].length === 0) {
        throw invalid("url must be a non-empty string");
    }
    if (typeof envelope["scanId"] !== "string" ||
        envelope["scanId"].length === 0) {
        throw invalid("scanId must be a non-empty string");
    }
    recordAt(envelope["report"], "report");
    const summary = recordAt(envelope["summary"], "summary");
    const byImpact = recordAt(summary["byImpact"], "summary.byImpact");
    const counts: ViolationCounts = {
        critical: countAt(byImpact["critical"], "summary.byImpact.critical"),
        serious: countAt(byImpact["serious"], "summary.byImpact.serious"),
        moderate: countAt(byImpact["moderate"], "summary.byImpact.moderate"),
        minor: countAt(byImpact["minor"], "summary.byImpact.minor"),
    };
    const violations = countAt(summary["total"], "summary.total");
    const countedViolations = counts.critical + counts.serious + counts.moderate + counts.minor;
    if (violations !== countedViolations) {
        throw invalid(`summary.total (${violations}) does not match severity counts (${countedViolations})`);
    }
    const exitCode = envelope["exitCode"];
    if (exitCode !== 0 && exitCode !== 1) {
        throw invalid("exitCode must be 0 or 1 for a completed scan");
    }
    return Object.freeze({
        score: scoreFromCounts(counts),
        violations,
        pass: exitCode === 0,
        counts: Object.freeze(counts),
    });
}
