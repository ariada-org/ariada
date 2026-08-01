// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
    ValueType,
    type Counter,
    type Gauge,
    type Histogram,
    type Meter,
} from '@opentelemetry/api';
import { ARIADA_IMPACTS, type AriadaImpact, type ParsedAriadaScanResult } from './types.js';
export const ARIADA_METRIC_NAMES = {
    violations: 'ariada.violations.count',
    score: 'ariada.score',
    gate: 'ariada.gate',
    timestamp: 'ariada.scan.timestamp',
    duration: 'ariada.scan.duration',
} as const;
interface AriadaInstruments {
    violations: Counter;
    score: Gauge;
    gate: Gauge;
    timestamp: Gauge;
    duration: Histogram;
}
const instrumentsByMeter = new WeakMap<Meter, AriadaInstruments>();
function instrumentsFor(meter: Meter): AriadaInstruments {
    const existing = instrumentsByMeter.get(meter);
    if (existing !== undefined) {
        return existing;
    }
    const instruments = {
        violations: meter.createCounter(ARIADA_METRIC_NAMES.violations, {
            description: 'Ariada violations observed in completed scans, grouped by rule and impact.',
            unit: '{violation}',
            valueType: ValueType.INT,
        }),
        score: meter.createGauge(ARIADA_METRIC_NAMES.score, {
            description: 'Per-scan Ariada score from 0 (critical) to 1 (clean).',
            unit: '1',
        }),
        gate: meter.createGauge(ARIADA_METRIC_NAMES.gate, {
            description: 'Per-scan Ariada gate result: 1 for pass and 0 for fail.',
            unit: '1',
            valueType: ValueType.INT,
        }),
        timestamp: meter.createGauge(ARIADA_METRIC_NAMES.timestamp, {
            description: 'Scan completion timestamp, or start timestamp when completion is unavailable.',
            unit: 's',
        }),
        duration: meter.createHistogram(ARIADA_METRIC_NAMES.duration, {
            description: 'Ariada scan duration.',
            unit: 'ms',
        }),
    };
    instrumentsByMeter.set(meter, instruments);
    return instruments;
}
function groupViolations(scan: ParsedAriadaScanResult): Map<AriadaImpact, Map<string, number>> {
    const grouped = new Map<AriadaImpact, Map<string, number>>();
    for (const impact of ARIADA_IMPACTS) {
        grouped.set(impact, new Map());
    }
    for (const finding of scan.findings) {
        const rules = grouped.get(finding.severity);
        if (rules === undefined) {
            continue;
        }
        rules.set(finding.ruleId, (rules.get(finding.ruleId) ?? 0) + 1);
    }
    return grouped;
}
export function recordAriadaMetrics(scan: ParsedAriadaScanResult, meter: Meter): void {
    const instruments = instrumentsFor(meter);
    const grouped = groupViolations(scan);
    for (const impact of ARIADA_IMPACTS) {
        for (const [rule, count] of grouped.get(impact) ?? []) {
            instruments.violations.add(count, { rule, impact, url: scan.url });
        }
    }
    instruments.score.record(scan.score, { url: scan.url });
    instruments.gate.record(scan.gate === 'pass' ? 1 : 0, {
        url: scan.url,
        result: scan.gate,
    });
    if (scan.durationMs !== undefined) {
        instruments.duration.record(scan.durationMs, { url: scan.url });
    }
    const timestampMillis = scan.completedAtEpochMillis ?? scan.startedAtEpochMillis;
    if (timestampMillis !== undefined) {
        instruments.timestamp.record(timestampMillis / 1_000, { url: scan.url });
    }
}
