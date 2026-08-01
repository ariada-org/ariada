// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import { runScan as runCliScan } from '@ariada-org/cli';
import { accessibilityDomain, runMultiDomainScan, type Finding, type PropertySnapshot, type Severity, type UnifiedSnapshot } from '@ariada-org/core-engine';
import type { AriadaCaptureMode, AriadaDomSource, AriadaFallbackReason, AriadaScanOptions, AriadaScanResult, AriadaWdioBrowser } from './types.js';
const RANK: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
interface CapturedPage { snapshot: PropertySnapshot; mode: AriadaCaptureMode; domSource: AriadaDomSource; fallbackReason?: AriadaFallbackReason }
interface CliEnvelope {
    scanId?: unknown;
    summary?: { total?: unknown; byImpact?: unknown };
    report?: { findings?: unknown };
}
/** Capture the current WDIO page and run the shared Ariada engine/CLI pipeline. */
export async function runAriadaScan(browser: AriadaWdioBrowser, options: AriadaScanOptions = {}): Promise<AriadaScanResult> {
    const outputDir = resolve(options.outputDir ?? 'ariada-output/wdio');
    await mkdir(outputDir, { recursive: true });
    const capture = await captureCurrentPage(browser);
    const startedAt = Date.now();
    const coreReport = await buildCoreReport(capture.snapshot, startedAt);
    const stdout = new TextSink();
    const stderr = new TextSink();
    const threshold = options.severityThreshold ?? 'moderate';
    const exitCode = await runCliScan(String(capture.snapshot.url), { outputDir, format: 'json', severityThreshold: threshold }, stdout, stderr, async () => ({ report: coreReport }));
    if (exitCode !== 0 && exitCode !== 1) {
        throw new Error(`WDIO Ariada scan did not produce a report: ${stderr.text() || stdout.text() || exitCode}`);
    }
    const artifactPath = resolve(outputDir, 'scan.json');
    const envelope = parseCliEnvelope(await readFile(artifactPath, 'utf8'));
    const findings = flattenFindings(envelope.report?.findings);
    const byImpact = asRecord(envelope.summary?.byImpact);
    return {
        url: String(capture.snapshot.url),
        scanId: typeof envelope.scanId === 'string' ? envelope.scanId : String(capture.snapshot.scanId),
        exitCode: exitCode as 0 | 1,
        mode: capture.mode,
        domSource: capture.domSource,
        ...(capture.fallbackReason !== undefined ? { fallbackReason: capture.fallbackReason } : {}),
        summary: {
            total: numberAt(envelope.summary?.total, findings.length),
            byImpact: {
                critical: numberAt(byImpact?.critical, 0),
                serious: numberAt(byImpact?.serious, 0),
                moderate: numberAt(byImpact?.moderate, 0),
                minor: numberAt(byImpact?.minor, 0),
            },
        },
        findings,
        blockingCount: findings.filter((finding) => RANK[finding.severity] >= RANK[threshold]).length,
        outputDir,
        artifactPath,
    };
}
async function captureCurrentPage(browser: AriadaWdioBrowser): Promise<CapturedPage> {
    const startedAt = performance.now();
    const scanId = randomUUID();
    const url = await browser.getUrl();
    const html = await browser.getPageSource();
    const domStartedAt = performance.now();
    let domOutline = await captureDomViaWebDriver(browser);
    let domSource: AriadaDomSource = domOutline.length > 0 ? 'webdriver-execute' : 'html-only';
    const axStartedAt = performance.now();
    const ax = await captureAxViaCdp(browser);
    if (ax.domOutline.length > 0) {
        domOutline = ax.domOutline;
        domSource = 'cdp';
    }
    const snapshot: PropertySnapshot = {
        scanId, url, timestamp: Date.now(), html, headers: {}, cookies: [], networkResources: [],
        axTree: ax.nodes, domOutline, perfMetrics: {},
        timings: { navigationMs: 0, axTreeMs: performance.now() - axStartedAt, domMs: performance.now() - domStartedAt, totalMs: performance.now() - startedAt },
    };
    return {
        snapshot,
        mode: ax.nodes.length > 0 ? 'ax-tree' : 'dom-fallback',
        domSource,
        ...(ax.fallbackReason !== undefined ? { fallbackReason: ax.fallbackReason } : {}),
    };
}
async function buildCoreReport(snapshot: PropertySnapshot, startedAt: number): Promise<Record<string, unknown>> {
    const result = await runMultiDomainScan({ snapshots: [snapshot], domains: [accessibilityDomain] });
    const findings = result.grid;
    const url = String(snapshot.url);
    const domainFindings = (findings?.[url]?.[accessibilityDomain.id] ?? []);
    return { scanId: snapshot.scanId, url, timestamp: startedAt, snapshot, findings: { accessibility: domainFindings }, conflicts: [], stats: { totalViolations: domainFindings.length, durationMs: Date.now() - startedAt, analyzersRun: [accessibilityDomain.id], elementsScanned: snapshot.domOutline.length } };
}
async function captureDomViaWebDriver(browser: AriadaWdioBrowser): Promise<UnifiedSnapshot['domOutline']> {
    if (typeof browser.execute !== 'function')
        return [];
    try {
        const value = await browser.execute(collectDomOutlineInPage);
        return isDomOutline(value) ? value : [];
    }
    catch {
        return [];
    }
}
function collectDomOutlineInPage(): unknown {
    const doc = globalThis.document;
    if (!doc)
        return [];
    return Array.from(doc.querySelectorAll('*')).map((element, index) => ({ backendNodeId: index + 1, nodeName: String((element as unknown as Record<string, unknown>)['tagName'] ?? '').toUpperCase(), selector: String((element as unknown as Record<string, unknown>)['tagName'] ?? '').toLowerCase(), attributes: {} }));
}
async function captureAxViaCdp(browser: AriadaWdioBrowser): Promise<{ nodes: UnifiedSnapshot['axTree']; domOutline: UnifiedSnapshot['domOutline']; fallbackReason?: AriadaFallbackReason }> {
    if (typeof browser.cdp !== 'function')
        return { nodes: [], domOutline: [], fallbackReason: 'cdp-unavailable' };
    try {
        const rawAx = await browser.cdp!('Accessibility', 'getFullAXTree', { depth: -1 });
        const nodes = extractAxNodes(rawAx);
        if (nodes.length === 0)
            return { nodes: [], domOutline: [], fallbackReason: 'empty-ax-tree' };
        let domOutline: UnifiedSnapshot['domOutline'] = [];
        try {
            domOutline = extractCdpDomOutline(await browser.cdp!('DOM', 'getFlattenedDocument', { depth: -1, pierce: true }));
        }
        catch { /* WebDriver DOM remains the explicit fallback. */ }
        return { nodes, domOutline };
    }
    catch {
        return { nodes: [], domOutline: [], fallbackReason: 'cdp-command-failed' };
    }
}
function extractAxNodes(value: unknown): UnifiedSnapshot['axTree'] {
    const record = asRecord(value);
    return Array.isArray(record?.nodes) ? record.nodes.filter((node) => asRecord(node) !== undefined && typeof asRecord(node)?.nodeId === 'string') as UnifiedSnapshot['axTree'] : [];
}
function extractCdpDomOutline(value: unknown): UnifiedSnapshot['domOutline'] {
    const nodes = asRecord(value)?.nodes;
    if (!Array.isArray(nodes))
        return [];
    return nodes.flatMap((node) => {
        const item = asRecord(node);
        if (item?.nodeType !== 1 || typeof item.backendNodeId !== 'number' || typeof item.nodeName !== 'string')
            return [];
        const attrs = attributePairs(item.attributes);
        const tag = item.nodeName.toLowerCase();
        return [{ backendNodeId: item.backendNodeId, nodeName: item.nodeName.toUpperCase(), selector: typeof attrs.id === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(attrs.id) ? `${tag}#${attrs.id}` : tag, ...(Object.keys(attrs).length ? { attributes: attrs } : {}) }];
    });
}
function attributePairs(value: unknown): Record<string, string> { const out: Record<string, string> = {}; if (!Array.isArray(value))
    return out; for (let i = 0; i + 1 < value.length; i += 2)
    if (typeof value[i] === 'string' && typeof value[i + 1] === 'string')
        out[value[i]] = value[i + 1]; return out; }
function isDomOutline(value: unknown): value is UnifiedSnapshot['domOutline'] { return Array.isArray(value) && value.every((entry) => { const r = asRecord(entry); return r !== undefined && typeof r.backendNodeId === 'number' && typeof r.nodeName === 'string' && typeof r.selector === 'string'; }); }
function parseCliEnvelope(raw: string): CliEnvelope { const value = JSON.parse(raw) as unknown; const record = asRecord(value); if (record?.['$schema'] !== 'https://ariada.org/schemas/cli-scan.v1.json' || !asRecord(record.summary) || !asRecord(record.report))
    throw new Error('WDIO Ariada scan produced a non-canonical or incomplete scan.json envelope'); return record as unknown as CliEnvelope; }
function flattenFindings(value: unknown): Finding[] { if (Array.isArray(value))
    return value as Finding[]; const record = asRecord(value); return record ? Object.values(record).flatMap((items) => Array.isArray(items) ? items as Finding[] : []) : []; }
function asRecord(value: unknown): Record<string, unknown> | undefined { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined; }
function numberAt(value: unknown, fallback: number): number { return typeof value === 'number' ? value : fallback; }
class TextSink extends Writable {
    private readonly chunks: Buffer[] = [];
    override _write(chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void { this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)); callback(); }
    text(): string { return Buffer.concat(this.chunks).toString('utf8').trim(); }
}
