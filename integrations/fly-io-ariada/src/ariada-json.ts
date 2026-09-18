export type AriadaImpact = "critical" | "serious" | "moderate" | "minor";
export interface AriadaImpactCounts {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
}
export interface AriadaScanEnvelope {
    schema: "https://ariada.org/schemas/cli-scan.v1.json";
    url: string;
    durationMs: number;
    summary: {
        total: number;
        byImpact: AriadaImpactCounts;
    };
    report: Record<string, unknown>;
    exitCode: 0 | 1;
}
export interface AriadaCliError {
    level: "error";
    code: string;
    message: string;
    details?: unknown;
}

/** Raised when the scanner answered, but not in the shape the contract names. */
export class AriadaProtocolError extends Error {
    readonly name = "AriadaProtocolError";
}
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (!isRecord(value)) {
        throw new AriadaProtocolError(`${label} must be a JSON object`);
    }
    return value;
}
function requireNonNegativeInteger(value: unknown, label: string): number {
    if (!Number.isInteger(value) || (value as number) < 0) {
        throw new AriadaProtocolError(`${label} must be a non-negative integer`);
    }
    return value as number;
}

function requireString(value: unknown, label: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new AriadaProtocolError(`${label} must be a non-empty string`);
    }
    return value;
}
export function parseAriadaScanJson(text: string): AriadaScanEnvelope {
    let value: unknown;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new AriadaProtocolError("Ariada scan report is not valid JSON");
    }
    const envelope = requireRecord(value, "Ariada scan report");
    if (envelope["$schema"] !== "https://ariada.org/schemas/cli-scan.v1.json") {
        throw new AriadaProtocolError("Ariada scan report has an unsupported schema");
    }
    const url = requireString(envelope["url"], "Ariada scan report url");
    try {
        new URL(url);
    }
    catch {
        throw new AriadaProtocolError("Ariada scan report url is invalid");
    }
    const durationMs = requireNonNegativeInteger(envelope["durationMs"], "Ariada scan report durationMs");
    const summary = requireRecord(envelope["summary"], "Ariada summary");
    const byImpact = requireRecord(summary["byImpact"], "Ariada byImpact");
    const report = requireRecord(envelope["report"], "Ariada report payload");
    const exitCode = envelope["exitCode"];
    if (exitCode !== 0 && exitCode !== 1) {
        throw new AriadaProtocolError("Ariada scan report exitCode must be 0 or 1");
    }
    return {
        schema: "https://ariada.org/schemas/cli-scan.v1.json",
        url,
        durationMs,
        summary: {
            total: requireNonNegativeInteger(summary["total"], "Ariada summary total"),
            byImpact: {
                critical: requireNonNegativeInteger(byImpact["critical"], "Ariada critical count"),
                serious: requireNonNegativeInteger(byImpact["serious"], "Ariada serious count"),
                moderate: requireNonNegativeInteger(byImpact["moderate"], "Ariada moderate count"),
                minor: requireNonNegativeInteger(byImpact["minor"], "Ariada minor count"),
            },
        },
        report,
        exitCode,
    };
}
// The last error line wins, and lines that are not the contract are stepped
// over rather than refused: the scanner may write anything to its error stream,
// and the structured line is the one worth reading.
export function parseAriadaError(stderr: string): AriadaCliError | undefined {
    const lines = stderr
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .reverse();
    for (const line of lines) {
        let value: unknown;
        try {
            value = JSON.parse(line);
        }
        catch {
            continue;
        }
        if (!isRecord(value)) {
            continue;
        }
        if (value["level"] !== "error" ||
            typeof value["code"] !== "string" ||
            typeof value["message"] !== "string") {
            continue;
        }
        const error: AriadaCliError = {
            level: "error",
            code: value["code"] as string,
            message: value["message"] as string,
        };
        if ("details" in value) {
            error.details = value["details"];
        }
        return error;
    }
    return undefined;
}
