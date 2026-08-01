// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/** @internal */
export {};
import type { Finding, Severity } from '@ariada-org/core-engine';

export type AriadaCaptureMode = 'ax-tree' | 'dom-fallback';
export type AriadaDomSource = 'cdp' | 'webdriver-execute' | 'html-only';
export type AriadaFallbackReason = 'cdp-unavailable' | 'cdp-command-failed' | 'empty-ax-tree';
/** Structural WDIO surface, compatible with WDIO v8/v9 and injected browser tests. */
export interface AriadaWdioBrowser {
    getUrl(): Promise<string>;
    getPageSource(): Promise<string>;
    execute?(script: () => unknown): Promise<unknown>;
    cdp?(domain: string, command: string, params?: Record<string, unknown>): Promise<unknown>;
}
export interface AriadaScanOptions { outputDir?: string; severityThreshold?: Severity }
export interface AriadaScanSummary { total: number; byImpact: Record<Severity, number> }
export interface AriadaScanResult {
    url: string; scanId: string; exitCode: 0 | 1; mode: AriadaCaptureMode; domSource: AriadaDomSource;
    fallbackReason?: AriadaFallbackReason; summary: AriadaScanSummary; findings: Finding[];
    blockingCount: number; outputDir: string; artifactPath: string;
}
export type AriadaHookName = 'afterTest' | 'afterCommand';
export interface AriadaReportAttachment extends AriadaScanResult { hook: AriadaHookName; label: string }
export interface AriadaServiceOptions extends AriadaScanOptions {
    scanAfterTest?: boolean; scanAfterCommand?: boolean | readonly string[]; failOnViolation?: boolean;
    onResult?: (attachment: AriadaReportAttachment) => void | Promise<void>;
    log?: (line: string) => void;
}
export interface AriadaAnnotatedResult { ariada?: AriadaReportAttachment }
