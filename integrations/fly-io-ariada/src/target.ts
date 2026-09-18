import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConfigurationError, type WrapperConfig } from "./config.js";

export type TargetSource = "target-url" | "build-output" | "fly-app-name";
export interface TargetResolution {
    url: string;
    source: TargetSource;
}
// Every place a build has been seen to put its address. All of them are read,
// and two that disagree are a refusal rather than a first-one-wins: a wrapper
// that silently scanned the wrong deployment would report a clean site.
const CANDIDATE_PATHS: readonly { path: readonly string[]; hostname: boolean }[] = [
    { path: ["targetUrl"], hostname: false },
    { path: ["url"], hostname: false },
    { path: ["hostname"], hostname: true },
    { path: ["Hostname"], hostname: true },
    { path: ["app", "targetUrl"], hostname: false },
    { path: ["app", "url"], hostname: false },
    { path: ["app", "hostname"], hostname: true },
];
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function atPath(value: unknown, path: readonly string[]): unknown {
    let current: unknown = value;
    for (const segment of path) {
        if (!isRecord(current)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
function normalizeTarget(value: string, label: string): string {
    let parsed: URL;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new ConfigurationError(`${label} is not a valid URL`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ConfigurationError(`${label} must use http or https`);
    }
    if (parsed.username.length > 0 || parsed.password.length > 0) {
        throw new ConfigurationError(`${label} must not embed credentials`);
    }
    return parsed.href;
}
function normalizeHostname(value: string, label: string): string {
    if (!/^[a-z0-9.-]+(?::\d+)?$/iu.test(value)) {
        throw new ConfigurationError(`${label} is not a valid hostname`);
    }
    return normalizeTarget(`https://${value}`, label);
}
async function loadBuildOutput(config: WrapperConfig): Promise<unknown> {
    const buildOutput = config.buildOutput;
    if (buildOutput === undefined) {
        return undefined;
    }
    let text: string;
    if (buildOutput.startsWith("{") || buildOutput.startsWith("[")) {
        text = buildOutput;
    }
    else {
        const path = resolve(config.cwd, buildOutput);
        try {
            text = await readFile(path, "utf8");
        }
        catch (error) {
            throw new ConfigurationError(`ARIADA_BUILD_OUTPUT could not be read at ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw new ConfigurationError("ARIADA_BUILD_OUTPUT is not valid JSON");
    }
}
function targetFromBuildOutput(value: unknown): string {
    if (!isRecord(value)) {
        throw new ConfigurationError("ARIADA_BUILD_OUTPUT must contain a JSON object");
    }
    const candidates: string[] = [];
    for (const candidate of CANDIDATE_PATHS) {
        const raw = atPath(value, candidate.path);
        if (raw === undefined) {
            continue;
        }
        const label = `ARIADA_BUILD_OUTPUT.${candidate.path.join(".")}`;
        if (typeof raw !== "string" || raw.trim().length === 0) {
            throw new ConfigurationError(`${label} must be a non-empty string`);
        }
        const normalized = candidate.hostname
            ? normalizeHostname(raw.trim(), label)
            : normalizeTarget(raw.trim(), label);
        candidates.push(normalized);
    }
    const unique = [...new Set(candidates)];
    if (unique.length === 0) {
        throw new ConfigurationError("ARIADA_BUILD_OUTPUT does not contain a supported target URL field");
    }
    if (unique.length > 1) {
        throw new ConfigurationError("ARIADA_BUILD_OUTPUT contains conflicting target URL fields");
    }
    return unique[0] as string;
}
function targetFromFlyAppName(appName: string): string {
    if (appName.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(appName)) {
        throw new ConfigurationError("FLY_APP_NAME is not a valid Fly app name");
    }
    return `https://${appName}.fly.dev/`;
}
export async function resolveTarget(config: WrapperConfig): Promise<TargetResolution> {
    if (config.targetUrl !== undefined) {
        return {
            url: normalizeTarget(config.targetUrl, "ARIADA_TARGET_URL"),
            source: "target-url",
        };
    }
    if (config.buildOutput !== undefined) {
        return {
            url: targetFromBuildOutput(await loadBuildOutput(config)),
            source: "build-output",
        };
    }
    if (config.flyAppName !== undefined) {
        return {
            url: targetFromFlyAppName(config.flyAppName),
            source: "fly-app-name",
        };
    }
    throw new ConfigurationError("Set ARIADA_TARGET_URL, ARIADA_BUILD_OUTPUT, or FLY_APP_NAME");
}
