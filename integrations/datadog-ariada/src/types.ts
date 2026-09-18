export const ARIADA_IMPACTS = [
    "minor",
    "moderate",
    "serious",
    "critical",
] as const;

export type AriadaImpact = (typeof ARIADA_IMPACTS)[number];
export type AriadaGate = "pass" | "fail";
export interface AriadaViolation {
    readonly rule: string;
    readonly impact: AriadaImpact;
    readonly count: number;
}
export interface AriadaResult {
    readonly url: string;
    readonly score: number;
    readonly gate: AriadaGate;
    readonly violations: readonly AriadaViolation[];
}
export const DATADOG_SITES = [
    "datadoghq.com",
    "us3.datadoghq.com",
    "us5.datadoghq.com",
    "datadoghq.eu",
    "ap1.datadoghq.com",
    "ap2.datadoghq.com",
    "uk1.datadoghq.com",
    "ddog-gov.com",
    "us2.ddog-gov.com",
] as const;
export type DatadogSite = (typeof DATADOG_SITES)[number];
export interface DatadogConfig {
    readonly apiKey: string;
    readonly appKey: string;
    readonly site: DatadogSite;
}
export const DATADOG_METRIC_TYPE = {
    count: 1,
    gauge: 3,
} as const;
export type DatadogMetricType = (typeof DATADOG_METRIC_TYPE)[keyof typeof DATADOG_METRIC_TYPE];
export interface DatadogMetricPoint {
    readonly timestamp: number;
    readonly value: number;
}
export interface DatadogMetricSeries {
    readonly metric: "ariada.violations" | "ariada.score" | "ariada.gate";
    readonly type: DatadogMetricType;
    readonly interval?: number;
    readonly points: readonly DatadogMetricPoint[];
    readonly tags: readonly string[];
}
export interface DatadogMetricPayload {
    readonly series: readonly DatadogMetricSeries[];
}
export interface DatadogEventPayload {
    readonly title: string;
    readonly text: string;
    readonly date_happened: number;
    readonly priority: "normal";
    readonly alert_type: "error";
    readonly source_type_name: "ariada";
    readonly tags: readonly string[];
}
export type DatadogRequest = {
    readonly kind: "metrics";
    readonly method: "POST";
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: DatadogMetricPayload;
} | {
    readonly kind: "event";
    readonly method: "POST";
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: DatadogEventPayload;
};
export interface DatadogResponse {
    readonly status: number;
    readonly body?: unknown;
}
export interface DatadogTransport {
    send(request: DatadogRequest): Promise<DatadogResponse>;
}
export interface SendToDatadogOptions extends DatadogConfig {
    readonly timestamp?: number;
    readonly transport?: DatadogTransport;
}
export interface SendToDatadogResult {
    readonly timestamp: number;
    readonly metrics: DatadogResponse;
    readonly event: DatadogResponse | null;
}
