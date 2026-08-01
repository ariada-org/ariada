// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { DomainModule, Finding, MultiDomainReport, Severity } from '@ariada-org/core-engine';
import type { ExitCode } from '@ariada-org/cli';

export const ARIADA_ATTACHMENT_NAME = 'ariada-multi-domain-report';
export const ARIADA_ATTACHMENT_CONTENT_TYPE = 'application/vnd.ariada.multi-domain-report+json';
export const ARIADA_ARTIFACT_SCHEMA = 'https://ariada.org/schemas/playwright-ariada-artifact.v1.json';
export const ARIADA_REPORTER_SCHEMA = 'https://ariada.org/schemas/playwright-ariada-results.v1.json';

export type AriadaBrowserEngine = 'chromium' | 'firefox' | 'webkit' | 'unknown';
export interface AriadaScanOptions {
    readonly severityThreshold?: Severity;
    readonly domains?: readonly DomainModule[];
    readonly scanId?: string;
}
export type AriadaAxTreeCapability =
    | { readonly status: 'available'; readonly transport: 'cdp'; readonly nodeCount: number }
    | { readonly status: 'unavailable'; readonly transport: 'none'; readonly nodeCount: 0; readonly reason: string };
export interface AriadaScanCapabilities {
    readonly browser: AriadaBrowserEngine;
    readonly axTree: AriadaAxTreeCapability;
    readonly dom: {
        readonly status: 'available';
        readonly role: 'supplemental' | 'fallback';
        readonly nodeCount: number;
    };
}
export interface AriadaPolicyResult {
    readonly threshold: Severity;
    readonly blockingFindings: readonly Finding[];
    readonly exitCode: 0 | 1;
}
export interface AriadaScanResult {
    readonly report: MultiDomainReport;
    readonly capabilities: AriadaScanCapabilities;
    readonly policy: AriadaPolicyResult;
    readonly durationMs: number;
}
export interface AriadaCompleteArtifact {
    readonly $schema: typeof ARIADA_ARTIFACT_SCHEMA;
    readonly version: 1;
    readonly status: 'complete';
    readonly result: AriadaScanResult;
}
export interface AriadaErrorArtifact {
    readonly $schema: typeof ARIADA_ARTIFACT_SCHEMA;
    readonly version: 1;
    readonly status: 'error';
    readonly error: { readonly name: string; readonly message: string };
    readonly exitCode: ExitCode;
}
export type AriadaArtifact = AriadaCompleteArtifact | AriadaErrorArtifact;
