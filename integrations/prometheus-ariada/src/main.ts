#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { Registry } from "prom-client";

import { createAriadaExporter } from "./exporter.js";
import { createPromClientPushAdapter } from "./push.js";
import { createMetricsServer } from "./server.js";
function optionalEnvironment(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value === undefined || value === "" ? undefined : value;
}
function metricsPort(): number {
    const value = optionalEnvironment("ARIADA_METRICS_PORT") ?? "9464";
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("ARIADA_METRICS_PORT must be an integer from 1 through 65535");
    }
    return port;
}
async function main(): Promise<void> {
    const host = optionalEnvironment("ARIADA_METRICS_HOST") ?? "127.0.0.1";
    const port = metricsPort();
    const registry = new Registry();
    const pushgatewayUrl = optionalEnvironment("ARIADA_PUSHGATEWAY_URL");
    const pushAdapter = pushgatewayUrl === undefined
        ? undefined
        : createPromClientPushAdapter({
            url: pushgatewayUrl,
            jobName: optionalEnvironment("ARIADA_PUSHGATEWAY_JOB") ?? "ariada",
            registry,
        });
    const exporter = createAriadaExporter(pushAdapter === undefined
        ? { registry }
        : { registry, pushAdapter });
    const inputFile = optionalEnvironment("ARIADA_INPUT_FILE");
    if (inputFile !== undefined) {
        await exporter.ingest(await readFile(inputFile, "utf8"));
    }
    const server = createMetricsServer({ registry });
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
            reject(error);
        };
        server.once("error", onError);
        server.listen(port, host, () => {
            server.off("error", onError);
            resolve();
        });
    });
    console.log(`Ariada metrics listening on http://${host}:${port}/metrics`);
    let closing = false;
    const shutdown = (): void => {
        if (closing) {
            return;
        }
        closing = true;
        server.close((error) => {
            if (error !== undefined) {
                console.error(error);
                process.exitCode = 1;
            }
        });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start Ariada Prometheus exporter: ${message}`);
    process.exitCode = 1;
});
