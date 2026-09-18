import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { Registry } from "prom-client";

export interface MetricsServerOptions {
    readonly registry: Registry;
}
function pathnameOf(request: IncomingMessage): string {
    return (request.url ?? "/").split("?")[0] ?? "/";
}
async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    registry: Registry,
): Promise<void> {
    const pathname = pathnameOf(request);
    if (request.method === "GET" && pathname === "/metrics") {
        try {
            const metrics = await registry.metrics();
            response.statusCode = 200;
            response.setHeader("Content-Type", registry.contentType);
            response.end(metrics);
        }
        catch {
            response.statusCode = 500;
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.end("metrics collection failed\n");
        }
        return;
    }
    if (request.method === "GET" && pathname === "/healthz") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("ok\n");
        return;
    }
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("not found\n");
}
export function createMetricsServer(options: MetricsServerOptions) {
    return createServer((request, response) => {
        void handleRequest(request, response, options.registry);
    });
}
