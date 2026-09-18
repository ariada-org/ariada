import {
    DATADOG_METRIC_TYPE,
    type AriadaImpact,
    type AriadaResult,
    type AriadaViolation,
    type DatadogEventPayload,
    type DatadogMetricPayload,
    type DatadogMetricSeries,
} from "./types.js";
function compareText(left: string, right: string): number {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}
// Sorted, and this is not cosmetic: two runs of the same scan must produce the
// same payload, or a difference in ordering reads downstream as a change.
function sortedViolations(violations: readonly AriadaViolation[]): AriadaViolation[] {
    return [...violations].sort((left, right) => compareText(left.rule, right.rule) ||
        compareText(left.impact, right.impact));
}
function tags(url: string, rule: string, impact: string): string[] {
    return [`url:${url}`, `rule:${rule}`, `impact:${impact}`];
}
function violationSeries(
    url: string,
    timestamp: number,
    rule: string,
    impact: AriadaImpact | "none",
    count: number,
): DatadogMetricSeries {
    return {
        metric: "ariada.violations",
        type: DATADOG_METRIC_TYPE.count,
        interval: 1,
        points: [{ timestamp, value: count }],
        tags: tags(url, rule, impact),
    };
}
export function buildMetricPayload(result: AriadaResult, timestamp: number): DatadogMetricPayload {
    const violations = sortedViolations(result.violations);
    // A scan with nothing to report still sends one series at zero. Without it
    // the metric simply stops arriving, and a series that stopped is read as a
    // collector that broke rather than as a site that got better.
    const violationMetrics = violations.length === 0
        ? [violationSeries(result.url, timestamp, "none", "none", 0)]
        : violations.map((violation) => violationSeries(result.url, timestamp, violation.rule, violation.impact, violation.count));
    return {
        series: [
            ...violationMetrics,
            {
                metric: "ariada.score",
                type: DATADOG_METRIC_TYPE.gauge,
                points: [{ timestamp, value: result.score }],
                tags: tags(result.url, "all", "all"),
            },
            {
                metric: "ariada.gate",
                type: DATADOG_METRIC_TYPE.gauge,
                points: [{ timestamp, value: result.gate === "pass" ? 1 : 0 }],
                tags: tags(result.url, "all", "all"),
            },
        ],
    };
}
export function buildGateFailureEvent(result: AriadaResult, timestamp: number): DatadogEventPayload | null {
    if (result.gate === "pass") {
        return null;
    }
    const violations = sortedViolations(result.violations);
    const violationCount = violations.reduce((total, violation) => total + violation.count, 0);
    const ruleSummary = violations.length === 0
        ? "none"
        : violations
            .map((violation) => `${violation.rule} (${violation.impact}: ${violation.count})`)
            .join(", ");
    const rules = violations.length === 0
        ? ["none"]
        : [...new Set(violations.map((violation) => violation.rule))].sort(compareText);
    const impacts = violations.length === 0
        ? ["none"]
        : [...new Set(violations.map((violation) => violation.impact))].sort(compareText);
    return {
        title: "Ariada accessibility gate failed",
        text: [
            `URL: ${result.url}`,
            `Score: ${result.score}`,
            `Violations: ${violationCount}`,
            `Rules: ${ruleSummary}`,
        ].join("\n"),
        date_happened: timestamp,
        priority: "normal",
        alert_type: "error",
        source_type_name: "ariada",
        tags: [
            `url:${result.url}`,
            ...rules.map((rule) => `rule:${rule}`),
            ...impacts.map((impact) => `impact:${impact}`),
            "gate:fail",
        ],
    };
}
