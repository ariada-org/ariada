import type { DatadogRequest, DatadogResponse, DatadogTransport } from "./types.js";

export class DatadogDeliveryError extends Error {
    readonly kind: DatadogRequest["kind"];
    readonly status: number;
    readonly responseBody: unknown;

    constructor(kind: DatadogRequest["kind"], status: number, responseBody: unknown) {
        super(`Datadog ${kind} delivery failed with HTTP ${status}`);
        this.name = "DatadogDeliveryError";
        this.kind = kind;
        this.status = status;
        this.responseBody = responseBody;
    }
}
// A body that is not JSON is kept as text rather than discarded: the failure
// worth reading is usually the one the service wrote in prose.
async function responseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text === "") {
        return undefined;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
export function createFetchTransport(fetchImplementation: typeof fetch = globalThis.fetch): DatadogTransport {
    return {
        async send(request: DatadogRequest): Promise<DatadogResponse> {
            const response = await fetchImplementation(request.url, {
                method: request.method,
                headers: { ...request.headers },
                body: JSON.stringify(request.body),
            });
            const body = await responseBody(response);
            return body === undefined
                ? { status: response.status }
                : { status: response.status, body };
        },
    };
}
export function assertSuccessfulDelivery(kind: DatadogRequest["kind"], response: DatadogResponse): void {
    if (!Number.isInteger(response.status) || response.status < 100) {
        throw new TypeError(`Datadog transport returned an invalid ${kind} HTTP status`);
    }
    if (response.status < 200 || response.status >= 300) {
        throw new DatadogDeliveryError(kind, response.status, response.body);
    }
}
