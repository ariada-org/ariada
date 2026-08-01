// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { randomUUID } from 'node:crypto';
import { EXIT_OK, EXIT_VIOLATIONS } from '@ariada-org/cli';
import { discoverDomains, runMultiDomainScan, type DomainModule, type MultiDomainReport, type PropertySnapshot, type Severity, type UnifiedSnapshot } from '@ariada-org/core-engine';
import { captureSnapshot } from '@ariada-org/core-playwright';
import type { Page } from '@playwright/test';
import type { AriadaPolicyResult, AriadaScanCapabilities, AriadaScanOptions, AriadaScanResult } from './types.js';
interface CaptureOptions { scanId: string; url: string; screenshot: false }
interface ScanDependencies {
    capture(page: Page, options: CaptureOptions): Promise<UnifiedSnapshot>;
    scan(input: { snapshots: readonly PropertySnapshot[]; domains: readonly DomainModule[] }): Promise<MultiDomainReport>;
    domains(): readonly DomainModule[];
}
const ranks: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
const dependencies: ScanDependencies = { capture: (page, options) => captureSnapshot(page, options), scan: runMultiDomainScan, domains: () => discoverDomains({}).filter((domain) => domain.id === 'accessibility') };
export function createScanAdapter(overrides: Partial<ScanDependencies> = {}): (page: Page, options?: AriadaScanOptions) => Promise<AriadaScanResult> {
    const deps = { ...dependencies, ...overrides };
    return async (page, options = {}) => {
        if (page.isClosed())
            throw new Error('Ariada cannot scan a closed Playwright page');
        const threshold = options.severityThreshold ?? 'moderate';
        if (!(threshold in ranks))
            throw new Error(`Unsupported Ariada severity threshold: ${String(threshold)}`);
        const domains = options.domains ?? deps.domains();
        if (domains.length === 0)
            throw new Error('Ariada requires at least one canonical domain module');
        const started = Date.now();
        const snapshot = await deps.capture(page, { scanId: options.scanId ?? randomUUID(), url: page.url(), screenshot: false });
        if (snapshot.html === '' && snapshot.domOutline.length === 0)
            throw new Error('Ariada capture produced neither rendered HTML nor a DOM outline');
        const report = await deps.scan({ snapshots: [toPropertySnapshot(snapshot)], domains });
        return { report, capabilities: detectCapabilities(page, snapshot), policy: evaluatePolicy(report, threshold), durationMs: Date.now() - started };
    };
}
export const scanPage: (page: Page, options?: AriadaScanOptions) => Promise<AriadaScanResult> = createScanAdapter();
export function toPropertySnapshot(snapshot: UnifiedSnapshot): PropertySnapshot { return { scanId: snapshot.scanId, url: snapshot.url, timestamp: snapshot.timestamp, html: snapshot.html ?? '', headers: snapshot.headers ?? {}, cookies: snapshot.cookies ?? [], networkResources: snapshot.networkResources, axTree: snapshot.axTree, domOutline: snapshot.domOutline, perfMetrics: snapshot.perfMetrics, timings: snapshot.timings, ...(snapshot.axeFindings ? { axeFindings: snapshot.axeFindings } : {}) }; }
export function evaluatePolicy(report: MultiDomainReport, threshold: Severity = 'moderate'): AriadaPolicyResult { const minimum = ranks[threshold]; const blocking: AriadaPolicyResult['blockingFindings'][number][] = []; for (const site of report.sites)
    for (const domain of report.domains)
        for (const finding of report.grid[site]?.[domain] ?? [])
            if (ranks[finding.severity] >= minimum)
                blocking.push(finding); return { threshold, blockingFindings: blocking, exitCode: blocking.length > 0 ? EXIT_VIOLATIONS : EXIT_OK }; }
function detectCapabilities(page: Page, snapshot: UnifiedSnapshot): AriadaScanCapabilities { const name = page.context().browser()?.browserType().name(); const browser = name === 'chromium' || name === 'firefox' || name === 'webkit' ? name : 'unknown'; if (snapshot.axTree.length > 0)
    return { browser, axTree: { status: 'available', transport: 'cdp', nodeCount: snapshot.axTree.length }, dom: { status: 'available', role: 'supplemental', nodeCount: snapshot.domOutline.length } }; const reason = browser === 'chromium' ? 'Chromium CDP AX-tree capture returned no nodes; DOM rules ran as fallback.' : `${browser === 'firefox' || browser === 'webkit' ? browser : 'No Chromium CDP AX-tree'} does not expose Chromium CDP AX-tree capture; DOM rules ran as fallback.`; return { browser, axTree: { status: 'unavailable', transport: 'none', nodeCount: 0, reason }, dom: { status: 'available', role: 'fallback', nodeCount: snapshot.domOutline.length } }; }
