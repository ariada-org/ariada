// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { EXIT_RUNTIME_ERROR } from '@ariada-org/cli';
import { ARIADA_ARTIFACT_SCHEMA, type AriadaArtifact, type AriadaCompleteArtifact, type AriadaErrorArtifact, type AriadaScanResult } from './types.js';
export function createCompleteArtifact(result: AriadaScanResult): AriadaCompleteArtifact { return { $schema: ARIADA_ARTIFACT_SCHEMA, version: 1, status: 'complete', result }; }
export function createErrorArtifact(error: unknown): AriadaErrorArtifact { return { $schema: ARIADA_ARTIFACT_SCHEMA, version: 1, status: 'error', error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) }, exitCode: EXIT_RUNTIME_ERROR }; }
export function serializeAriadaArtifact(artifact: AriadaArtifact): string { return `${JSON.stringify(artifact, null, 2)}\n`; }
export function parseAriadaArtifact(value: string): AriadaArtifact {
    const parsed = JSON.parse(value);
    if (!record(parsed) || parsed['$schema'] !== ARIADA_ARTIFACT_SCHEMA)
        throw new Error('Attachment is not an Ariada Playwright artifact');
    if (parsed['version'] !== 1)
        throw new Error(`Unsupported Ariada artifact version: ${String(parsed['version'])}`);
    if (parsed['status'] === 'error') {
        if (!record(parsed['error']) || typeof parsed['error']['message'] !== 'string')
            throw new Error('Ariada error artifact has no error message');
        return parsed as unknown as AriadaErrorArtifact;
    }
    if (parsed['status'] !== 'complete' || !isScanResult(parsed['result']))
        throw new Error('Ariada complete artifact has an invalid scan result');
    return parsed as unknown as AriadaCompleteArtifact;
}
function isScanResult(value: unknown): value is AriadaScanResult { if (!record(value) || !record(value['report']) || !record(value['policy']))
    return false; const report = value['report']; const policy = value['policy']; return Array.isArray(report['sites']) && Array.isArray(report['domains']) && record(report['grid']) && Array.isArray(report['interactions']) && record(report['crossSite']) && Array.isArray(policy['blockingFindings']) && (policy['exitCode'] === 0 || policy['exitCode'] === 1) && record(value['capabilities']) && typeof value['durationMs'] === 'number'; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
