// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
    SpanStatusCode,
    type Attributes,
    type Tracer,
} from '@opentelemetry/api';
import type { ParsedAriadaScanResult } from './types.js';
export const ARIADA_SCAN_SPAN_NAME: "ariada.scan" = 'ariada.scan';
export const ARIADA_SCAN_EVENT_NAME: "ariada.scan.result" = 'ariada.scan.result';
function scanAttributes(scan: ParsedAriadaScanResult): Attributes {
    return {
        'ariada.scan.url': scan.url,
        'ariada.violations.count': scan.summary.total,
        'ariada.violations.critical.count': scan.summary.byImpact.critical,
        'ariada.violations.serious.count': scan.summary.byImpact.serious,
        'ariada.violations.moderate.count': scan.summary.byImpact.moderate,
        'ariada.violations.minor.count': scan.summary.byImpact.minor,
        'ariada.score': scan.score,
        'ariada.gate.passed': scan.gate === 'pass',
        'ariada.gate.result': scan.gate,
        ...(scan.scanId === undefined ? {} : { 'ariada.scan.id': scan.scanId }),
        ...(scan.durationMs === undefined
            ? {}
            : { 'ariada.scan.duration_ms': scan.durationMs }),
        ...(scan.startedAt === undefined
            ? {}
            : { 'ariada.scan.started_at': scan.startedAt }),
        ...(scan.completedAt === undefined
            ? {}
            : { 'ariada.scan.completed_at': scan.completedAt }),
    };
}
function historicalEndMillis(scan: ParsedAriadaScanResult): number | undefined {
    if (scan.startedAtEpochMillis === undefined) {
        return undefined;
    }
    return scan.completedAtEpochMillis ?? (scan.durationMs === undefined
        ? undefined
        : scan.startedAtEpochMillis + scan.durationMs);
}
export function recordAriadaSpan(scan: ParsedAriadaScanResult, tracer: Tracer): void {
    const attributes = scanAttributes(scan);
    const endMillis = historicalEndMillis(scan);
    const options = scan.startedAtEpochMillis !== undefined && endMillis !== undefined
        ? { attributes, startTime: scan.startedAtEpochMillis }
        : { attributes };
    const span = tracer.startSpan(ARIADA_SCAN_SPAN_NAME, options);
    try {
        span.setStatus(scan.gate === 'pass'
            ? { code: SpanStatusCode.OK }
            : {
                code: SpanStatusCode.ERROR,
                message: 'Ariada accessibility gate failed',
            });
        if (endMillis === undefined) {
            span.addEvent(ARIADA_SCAN_EVENT_NAME, attributes);
        }
        else {
            span.addEvent(ARIADA_SCAN_EVENT_NAME, attributes, endMillis);
        }
    }
    finally {
        if (endMillis === undefined) {
            span.end();
        }
        else {
            span.end(endMillis);
        }
    }
}
