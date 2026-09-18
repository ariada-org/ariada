import {
    parseAriadaResult,
    parseSendOptions,
    parseTimestamp,
} from "./parsing.js";
import { buildGateFailureEvent, buildMetricPayload } from "./payloads.js";
import {
    assertSuccessfulDelivery,
    createFetchTransport,
} from "./transport.js";
import type {
    DatadogRequest,
    SendToDatadogOptions,
    SendToDatadogResult,
} from "./types.js";
function headers(apiKey: string, appKey: string): Record<string, string> {
    return {
        Accept: "application/json",
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey,
        "DD-APPLICATION-KEY": appKey,
    };
}
export async function sendToDatadog(
    rawResult: unknown,
    rawOptions: SendToDatadogOptions,
): Promise<SendToDatadogResult> {
    const result = parseAriadaResult(rawResult);
    const options = parseSendOptions(rawOptions);
    const timestamp = parseTimestamp(options.timestamp ?? Math.floor(Date.now() / 1000));
    const transport = options.transport ?? createFetchTransport();
    const requestHeaders = headers(options.config.apiKey, options.config.appKey);
    const apiBaseUrl = `https://api.${options.config.site}`;
    const metricsRequest: DatadogRequest = {
        kind: "metrics",
        method: "POST",
        url: `${apiBaseUrl}/api/v2/series`,
        headers: requestHeaders,
        body: buildMetricPayload(result, timestamp),
    };
    const metrics = await transport.send(metricsRequest);
    assertSuccessfulDelivery("metrics", metrics);
    const eventPayload = buildGateFailureEvent(result, timestamp);
    if (eventPayload === null) {
        return { timestamp, metrics, event: null };
    }
    const eventRequest: DatadogRequest = {
        kind: "event",
        method: "POST",
        url: `${apiBaseUrl}/api/v1/events`,
        headers: requestHeaders,
        body: eventPayload,
    };
    const event = await transport.send(eventRequest);
    assertSuccessfulDelivery("event", event);
    return { timestamp, metrics, event };
}
export { AriadaValidationError, asSendOptions, parseAriadaJson, parseAriadaResult, parseDatadogConfig, parseDatadogEnvironment, parseTimestamp, } from "./parsing.js";
export { buildGateFailureEvent, buildMetricPayload } from "./payloads.js";
export { assertSuccessfulDelivery, createFetchTransport, DatadogDeliveryError, } from "./transport.js";
export {
    ARIADA_IMPACTS,
    DATADOG_METRIC_TYPE,
    DATADOG_SITES,
    type AriadaGate,
    type AriadaImpact,
    type AriadaResult,
    type AriadaViolation,
    type DatadogConfig,
    type DatadogEventPayload,
    type DatadogMetricPayload,
    type DatadogMetricPoint,
    type DatadogMetricSeries,
    type DatadogMetricType,
    type DatadogRequest,
    type DatadogResponse,
    type DatadogSite,
    type DatadogTransport,
    type SendToDatadogOptions,
    type SendToDatadogResult,
} from "./types.js";
