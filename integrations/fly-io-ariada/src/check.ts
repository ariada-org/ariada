import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
    AriadaProtocolError,
    parseAriadaError,
    parseAriadaScanJson,
    type AriadaCliError,
    type AriadaImpactCounts,
} from "./ariada-json.js";
import type { WrapperConfig } from "./config.js";
import { spawnSubprocess, type SubprocessRunner } from "./subprocess.js";
import { resolveTarget, type TargetResolution } from "./target.js";

export interface CheckDependencies {
    runSubprocess?: SubprocessRunner;
    environment?: NodeJS.ProcessEnv;
}
export interface CompletedCheckResult {
    version: 1;
    status: "passed" | "violations";
    mode: WrapperConfig["mode"];
    target: TargetResolution;
    ariadaExitCode: 0 | 1;
    exitCode: 0 | 1;
    reportPath: string;
    durationMs: number;
    summary: {
        total: number;
        byImpact: AriadaImpactCounts;
    };
}
export interface FailedCheckResult {
    version: 1;
    status: "error";
    mode: WrapperConfig["mode"];
    target: TargetResolution;
    ariadaExitCode: number | null;
    exitCode: number;
    error: AriadaCliError | {
        level: "error";
        code: "E_ARIADA_PROCESS";
        message: string;
        details: {
            signal: NodeJS.Signals | null;
        };
    };
}
export type CheckResult = CompletedCheckResult | FailedCheckResult;
function normalizeUrl(value: string): string {
    return new URL(value).href;
}
function normalizeFailureExitCode(exitCode: number | null): number {
    if (exitCode !== null && exitCode >= 2 && exitCode <= 5) {
        return exitCode;
    }
    return 3;
}
export async function runAriadaCheck(
    config: WrapperConfig,
    dependencies: CheckDependencies = {},
): Promise<CheckResult> {
    const target = await resolveTarget(config);
    await mkdir(config.outputRoot, { recursive: true });
    const runDirectory = await mkdtemp(join(config.outputRoot, "run-"));
    const reportPath = join(runDirectory, "scan.json");
    const args = [
        "scan",
        target.url,
        "--browser",
        config.browser,
        "--format",
        "json",
        "--output-dir",
        runDirectory,
        "--severity-threshold",
        config.severityThreshold,
        "--timeout-ms",
        String(config.timeoutMs),
    ];
    const runSubprocess = dependencies.runSubprocess ?? spawnSubprocess;
    const subprocess = await runSubprocess({
        command: config.ariadaCommand,
        args,
        cwd: config.cwd,
        env: {
            ...(dependencies.environment ?? process.env),
            NO_COLOR: "1",
        },
    });
    if (subprocess.exitCode !== 0 && subprocess.exitCode !== 1) {
        const parsedError = parseAriadaError(subprocess.stderr);
        const error = parsedError ?? {
            level: "error",
            code: "E_ARIADA_PROCESS",
            message: subprocess.exitCode === null
                ? "Ariada was terminated before returning an exit code"
                : `Ariada exited with code ${subprocess.exitCode}`,
            details: { signal: subprocess.signal },
        };
        return {
            version: 1,
            status: "error",
            mode: config.mode,
            target,
            ariadaExitCode: subprocess.exitCode,
            exitCode: normalizeFailureExitCode(subprocess.exitCode),
            error,
        };
    }
    let reportText: string;
    try {
        reportText = await readFile(reportPath, "utf8");
    }
    catch (error) {
        throw new AriadaProtocolError(`Ariada exited ${subprocess.exitCode} but scan.json could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
    const report = parseAriadaScanJson(reportText);
    if (report.exitCode !== subprocess.exitCode) {
        throw new AriadaProtocolError(`Ariada process exit ${subprocess.exitCode} does not match report exit ${report.exitCode}`);
    }
    if (normalizeUrl(report.url) !== normalizeUrl(target.url)) {
        throw new AriadaProtocolError(`Ariada report URL ${report.url} does not match target ${target.url}`);
    }
    const hasViolations = report.exitCode === 1;
    const exitCode = hasViolations && config.mode === "gate" ? 1 : 0;
    return {
        version: 1,
        status: hasViolations ? "violations" : "passed",
        mode: config.mode,
        target,
        ariadaExitCode: report.exitCode,
        exitCode,
        reportPath,
        durationMs: report.durationMs,
        summary: report.summary,
    };
}
