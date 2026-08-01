// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { recordAriadaMetrics } from './metrics.js';
import { parseAriadaScanResult } from './parser.js';
import { recordAriadaSpan } from './spans.js';
import type { Meter, Tracer } from '@opentelemetry/api';
export { ARIADA_METRIC_NAMES } from './metrics.js';
export { AriadaScanParseError, parseAriadaScanResult } from './parser.js';
export { ARIADA_SCAN_EVENT_NAME, ARIADA_SCAN_SPAN_NAME } from './spans.js';
export {
    ARIADA_CLI_SCAN_SCHEMA,
    ARIADA_IMPACTS,
    type AriadaCliFinding,
    type AriadaCliFindings,
    type AriadaCliReport,
    type AriadaCliScanResult,
    type AriadaCliSummary,
    type AriadaGateResult,
    type AriadaImpact,
    type AriadaImpactCounts,
    type ParsedAriadaScanResult,
} from './types.js';
/**
 * Validate an existing Ariada CLI result and record its metrics and trace data.
 * This function performs no scan, file I/O, SDK registration, export, or network call.
 */
export function recordAriadaScan(result: unknown, meter: Meter, tracer: Tracer): void {
    const scan = parseAriadaScanResult(result);
    recordAriadaMetrics(scan, meter);
    recordAriadaSpan(scan, tracer);
}
