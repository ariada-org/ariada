import { Gauge, Registry } from "prom-client";

import { AriadaParseError, parseAriadaScan, type AriadaScan } from "./parser.js";
import type { PushAdapter } from "./push.js";

export interface AriadaExporter {
    readonly registry: Registry;
    ingest(input: unknown): Promise<AriadaScan>;
    scrape(): Promise<string>;
}

export interface AriadaExporterOptions {
    readonly registry?: Registry;
    readonly pushAdapter?: PushAdapter;
}

interface AggregatedViolation {
    readonly labels: Record<string, string>;
    count: number;
}
// Two findings with the same rule, impact and address are one series with a
// larger count, not two series. Setting a gauge twice for the same labels keeps
// only the second value, so aggregating here is what makes the total right.
function aggregateViolations(scan: AriadaScan): AggregatedViolation[] {
    const aggregated = new Map<string, AggregatedViolation>();
    for (const violation of scan.violations) {
        const labels = {
            rule: violation.rule,
            impact: violation.impact,
            url: violation.url,
        };
        const key = JSON.stringify([
            labels.rule,
            labels.impact,
            labels.url,
        ]);
        const existing = aggregated.get(key);
        if (existing === undefined) {
            aggregated.set(key, { labels, count: violation.count });
            continue;
        }
        const nextCount = existing.count + violation.count;
        if (!Number.isSafeInteger(nextCount)) {
            throw new AriadaParseError("$.violations", "combined count exceeds the safe integer range");
        }
        existing.count = nextCount;
    }
    return [...aggregated.values()];
}
export function createAriadaExporter(options: AriadaExporterOptions = {}): AriadaExporter {
    const registry = options.registry ?? new Registry();
    const violationsGauge = new Gauge({
        name: "ariada_violations_total",
        help: "Current Ariada violations in the latest scan snapshot",
        labelNames: ["rule", "impact", "url"],
        registers: [registry],
    });
    const scoreGauge = new Gauge({
        name: "ariada_score",
        help: "Ariada accessibility score for the latest scan",
        labelNames: ["url"],
        registers: [registry],
    });
    const gateGauge = new Gauge({
        name: "ariada_gate",
        help: "Whether the latest Ariada scan passed its gate (1 pass, 0 fail)",
        labelNames: ["url"],
        registers: [registry],
    });
    const timestampGauge = new Gauge({
        name: "ariada_scan_timestamp",
        help: "Unix timestamp in seconds for the latest Ariada scan",
        labelNames: ["url"],
        registers: [registry],
    });
    // What was published last time for this address, so it can be withdrawn.
    // A rule that no longer appears would otherwise keep its old value forever —
    // a series that stopped being true and never stopped being reported.
    const violationLabelsByScanUrl = new Map<string, Record<string, string>[]>();
    return {
        registry,
        async ingest(input: unknown): Promise<AriadaScan> {
            const scan = parseAriadaScan(input);
            const nextViolations = aggregateViolations(scan);
            const previousLabels = violationLabelsByScanUrl.get(scan.url) ?? [];
            for (const labels of previousLabels) {
                violationsGauge.remove(labels);
            }
            for (const violation of nextViolations) {
                violationsGauge.set(violation.labels, violation.count);
            }
            violationLabelsByScanUrl.set(scan.url, nextViolations.map((violation) => violation.labels));
            scoreGauge.set({ url: scan.url }, scan.score);
            gateGauge.set({ url: scan.url }, scan.gate ? 1 : 0);
            timestampGauge.set({ url: scan.url }, Date.parse(scan.timestamp) / 1000);
            await options.pushAdapter?.push();
            return scan;
        },
        scrape(): Promise<string> {
            return registry.metrics();
        },
    };
}
