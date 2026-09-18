#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
    AriadaValidationError,
    asSendOptions,
    parseAriadaJson,
    parseDatadogEnvironment,
    parseTimestamp,
} from "./parsing.js";
import type { DatadogTransport } from "./types.js";

import { sendToDatadog } from "./index.js";

export interface CliIo {
    readInput(path: string): Promise<string>;
    writeOutput(value: string): void;
    writeError(value: string): void;
}

export interface CliDependencies {
    readonly io?: CliIo;
    readonly now?: () => number;
    readonly transport?: DatadogTransport;
}

const HELP = `Usage: ariada-datadog [--input <path|->] [--timestamp <seconds>]

Reads strict Ariada CLI JSON from stdin by default and submits its metrics and
gate-failure event to the Datadog site configured in the environment.

Options:
  --input <path|->       Read JSON from a file or stdin (-).
  --timestamp <seconds>  Use a fixed POSIX timestamp for the payload.
  --help                 Show this help.
`;
function readStdin(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let input = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk: string) => {
            input += chunk;
        });
        process.stdin.on("end", () => {
            resolve(input);
        });
        process.stdin.on("error", reject);
    });
}
const defaultIo: CliIo = {
    readInput(path: string): Promise<string> {
        return path === "-" ? readStdin() : readFile(path, "utf8");
    },
    writeOutput(value: string): void {
        process.stdout.write(value);
    },
    writeError(value: string): void {
        process.stderr.write(value);
    },
};
function optionValue(args: readonly string[], index: number): string {
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
        throw new AriadaValidationError(`${args[index]} requires a value`);
    }
    return value;
}
// Each option may appear once. A second one is refused rather than silently
// winning, because the two readings of `--timestamp a --timestamp b` are both
// defensible and neither is what the caller meant.
function parseArguments(args: readonly string[]): { help: boolean; input: string; timestamp?: number } {
    let help = false;
    let input = "-";
    let timestamp: number | undefined;
    let inputSeen = false;
    let timestampSeen = false;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        switch (argument) {
            case "--help":
            case "-h":
                if (help) {
                    throw new AriadaValidationError("--help may be provided only once");
                }
                help = true;
                break;
            case "--input": {
                if (inputSeen) {
                    throw new AriadaValidationError("--input may be provided only once");
                }
                input = optionValue(args, index);
                inputSeen = true;
                index += 1;
                break;
            }
            case "--timestamp": {
                if (timestampSeen) {
                    throw new AriadaValidationError("--timestamp may be provided only once");
                }
                const rawTimestamp = optionValue(args, index);
                timestamp = parseTimestamp(Number(rawTimestamp), "--timestamp");
                timestampSeen = true;
                index += 1;
                break;
            }
            default:
                throw new AriadaValidationError(`unknown argument: ${argument ?? "<missing>"}`);
        }
    }
    return {
        help,
        input,
        ...(timestamp === undefined ? {} : { timestamp }),
    };
}
export async function runCli(
    args: readonly string[],
    environment: Readonly<Record<string, string | undefined>> = process.env,
    dependencies: CliDependencies = {},
): Promise<number> {
    const io = dependencies.io ?? defaultIo;
    try {
        const parsedArguments = parseArguments(args);
        if (parsedArguments.help) {
            io.writeOutput(HELP);
            return 0;
        }
        const input = await io.readInput(parsedArguments.input);
        const result = parseAriadaJson(input);
        const config = parseDatadogEnvironment(environment);
        const timestamp = parseTimestamp(parsedArguments.timestamp ??
            dependencies.now?.() ??
            Math.floor(Date.now() / 1000));
        const delivery = await sendToDatadog(result, asSendOptions(config, timestamp, dependencies.transport));
        io.writeOutput(`${JSON.stringify({
            timestamp: delivery.timestamp,
            metricsStatus: delivery.metrics.status,
            eventStatus: delivery.event?.status ?? null,
        })}\n`);
        return 0;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "unknown CLI failure";
        io.writeError(`ariada-datadog: ${message}\n`);
        return 1;
    }
}
const executable = process.argv[1];
if (executable !== undefined &&
    import.meta.url === pathToFileURL(executable).href) {
    void runCli(process.argv.slice(2)).then((exitCode) => {
        process.exitCode = exitCode;
    });
}
