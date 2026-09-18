import { resolve } from "node:path";

export type GateMode = "gate" | "report-only";
export type BrowserName = "chromium" | "firefox" | "webkit";
export type SeverityThreshold = "minor" | "moderate" | "serious" | "critical";
export interface WrapperConfig {
    targetUrl: string | undefined;
    buildOutput: string | undefined;
    flyAppName: string | undefined;
    mode: GateMode;
    browser: BrowserName;
    severityThreshold: SeverityThreshold;
    timeoutMs: number;
    outputRoot: string;
    ariadaCommand: string;
    cwd: string;
}
export class ConfigurationError extends Error {
    readonly name = "ConfigurationError";
}
function optional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}
function choice<T extends string>(
    name: string,
    value: string | undefined,
    fallback: T,
    values: readonly T[],
): T {
    const selected = optional(value) ?? fallback;
    if (!values.includes(selected as T)) {
        throw new ConfigurationError(`${name} must be one of ${values.join(", ")}; received ${selected}`);
    }
    return selected as T;
}

function positiveInteger(name: string, value: string | undefined, fallback: number): number {
    const selected = optional(value);
    if (selected === undefined) {
        return fallback;
    }
    const parsed = Number(selected);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new ConfigurationError(`${name} must be a positive integer`);
    }
    return parsed;
}
export function loadConfig(environment: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): WrapperConfig {
    const output = optional(environment["ARIADA_OUTPUT_DIR"]);
    const ariadaCommand = optional(environment["ARIADA_COMMAND"]) ?? "ariada";
    return {
        targetUrl: optional(environment["ARIADA_TARGET_URL"]),
        buildOutput: optional(environment["ARIADA_BUILD_OUTPUT"]),
        flyAppName: optional(environment["FLY_APP_NAME"]),
        mode: choice("ARIADA_MODE", environment["ARIADA_MODE"], "gate", ["gate", "report-only"]),
        browser: choice("ARIADA_BROWSER", environment["ARIADA_BROWSER"], "chromium", ["chromium", "firefox", "webkit"]),
        severityThreshold: choice("ARIADA_SEVERITY_THRESHOLD", environment["ARIADA_SEVERITY_THRESHOLD"], "serious", ["minor", "moderate", "serious", "critical"]),
        timeoutMs: positiveInteger("ARIADA_TIMEOUT_MS", environment["ARIADA_TIMEOUT_MS"], 120_000),
        outputRoot: resolve(cwd, output ?? "ariada-output"),
        ariadaCommand,
        cwd: resolve(cwd),
    };
}
