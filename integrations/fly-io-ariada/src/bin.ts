#!/usr/bin/env node
import { AriadaProtocolError } from "./ariada-json.js";
import { runAriadaCheck } from "./check.js";
import { ConfigurationError, loadConfig } from "./config.js";
function writeJson(stream: NodeJS.WriteStream, value: unknown): void {
    stream.write(`${JSON.stringify(value, null, 2)}\n`);
}
async function main(): Promise<void> {
    try {
        const result = await runAriadaCheck(loadConfig());
        writeJson(result.status === "error" ? process.stderr : process.stdout, result);
        process.exitCode = result.exitCode;
    }
    catch (error) {
        const isConfiguration = error instanceof ConfigurationError;
        const isProtocol = error instanceof AriadaProtocolError;
        const exitCode = isConfiguration ? 2 : 3;
        writeJson(process.stderr, {
            version: 1,
            status: "error",
            exitCode,
            error: {
                code: isConfiguration
                    ? "E_CONFIGURATION"
                    : isProtocol
                        ? "E_ARIADA_PROTOCOL"
                        : "E_WRAPPER_RUNTIME",
                message: error instanceof Error ? error.message : String(error),
            },
        });
        process.exitCode = exitCode;
    }
}
await main();
