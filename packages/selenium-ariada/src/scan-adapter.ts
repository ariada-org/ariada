// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AriadaAxTreeSource, AriadaFinding, AriadaScanDependencies, AriadaScanMode, AriadaScanOptions, AriadaScanResult, AriadaSeverity, CdpSessionLike, CliRunScan, WebDriverLike } from './types.js';
const SEVERITY_RANK: Record<AriadaSeverity, number> = {
    minor: 1,
    moderate: 2,
    serious: 3,
    critical: 4,
};
export class AriadaScanError extends Error {
    readonly code: 'CDP_UNAVAILABLE' | 'SCAN_FAILED';
    constructor(message: string, code: 'CDP_UNAVAILABLE' | 'SCAN_FAILED') {
        super(message);
        this.code = code;
        this.name = 'AriadaScanError';
    }
}
export class AriadaPolicyError extends Error {
    readonly result: AriadaScanResult;
    constructor(result: AriadaScanResult) {
        super(`ariada scan found ${result.policy.blockingCount} blocking violation(s)`);
        this.result = result;
        this.name = 'AriadaPolicyError';
    }
}
export async function ariadaScan(driver: WebDriverLike, options: AriadaScanOptions = {}, dependencies: AriadaScanDependencies = {}): Promise<AriadaScanResult> {
    const url = await driver.getCurrentUrl();
    const threshold = options.severityThreshold ?? 'moderate';
    if (options.fallback === 'cli') {
        const result = await runCliFallback(url, options, dependencies);
        enforcePolicy(result, options);
        return result;
    }
    const cdp = await resolveCdp(driver, dependencies.cdpSession);
    const axTree = unwrap(await cdp.send('Accessibility.getFullAXTree', { depth: -1 }));
    const nodesValue = axTree['nodes'];
    const nodes = Array.isArray(nodesValue) ? nodesValue : [];
    const axeSource = dependencies.loadAxeSource?.() ?? loadDefaultAxeSource();
    const source = await axeSource;
    await cdp.send('Runtime.evaluate', { expression: source, awaitPromise: true });
    const axeResponse = await cdp.send('Runtime.evaluate', {
        expression: 'axe.run()',
        awaitPromise: true,
        returnByValue: true,
    });
    const violations = extractViolations(axeResponse);
    const result = makeResult(url, 'selenium-cdp', 'selenium-session', nodes.length, violations, threshold);
    enforcePolicy(result, options);
    return result;
}
export const runAriadaScan = ariadaScan;
async function resolveCdp(driver: WebDriverLike, injected?: CdpSessionLike): Promise<CdpSessionLike> {
    if (injected)
        return injected;
    if (driver.createCDPConnection)
        return driver.createCDPConnection('page');
    if (driver.sendAndGetDevToolsCommand) {
        return { send: (method, params) => driver.sendAndGetDevToolsCommand!(method, params) };
    }
    throw new AriadaScanError("Selenium CDP is unavailable; pass { fallback: 'cli' } to use the DOM scanner", 'CDP_UNAVAILABLE');
}
async function runCliFallback(url: string, options: AriadaScanOptions, dependencies: AriadaScanDependencies): Promise<AriadaScanResult> {
    const outputDir = resolve(options.outputDir ?? (await mkdtemp(join(tmpdir(), 'ariada-selenium-'))));
    const runScan = dependencies.runScan ?? (await loadCliRunScan());
    await mkdir(outputDir, { recursive: true });
    await runScan(url, {
        outputDir,
        browser: 'chromium',
        format: 'json',
        severityThreshold: options.severityThreshold ?? 'moderate',
    });
    const envelope = JSON.parse(await readFile(join(outputDir, 'scan.json'), 'utf8')) as { report?: { findings?: unknown } };
    const findings = flattenFindings(envelope.report?.findings);
    return makeResult(url, 'dom-fallback', 'unavailable-from-webdriver', 0, findings, options.severityThreshold ?? 'moderate', outputDir);
}
async function loadCliRunScan(): Promise<CliRunScan> {
    const cli = (await import('@ariada-org/cli'));
    return cli.runScan;
}
async function loadDefaultAxeSource(): Promise<string> {
    const moduleName = 'axe-core';
    const axe = (await import(moduleName)) as { default?: { source?: string }; source?: string };
    return axe.default?.source ?? axe.source ?? '';
}
function makeResult(url: string, mode: AriadaScanMode, axTreeSource: AriadaAxTreeSource, axTreeNodeCount: number, findings: AriadaFinding[], threshold: AriadaSeverity, outputDir?: string): AriadaScanResult {
    const blockingCount = findings.filter((finding) => rank(finding.severity) >= SEVERITY_RANK[threshold]).length;
    const result: AriadaScanResult = {
        url, mode, axTreeSource, axTreeNodeCount, findings,
        policy: { threshold, blockingCount, passed: blockingCount === 0 },
    };
    if (outputDir !== undefined)
        result.outputDir = outputDir;
    return result;
}
function enforcePolicy(result: AriadaScanResult, options: AriadaScanOptions): void {
    if (options.failOnViolation && !result.policy.passed)
        throw new AriadaPolicyError(result);
}
function rank(value: string): number {
    return typeof value === 'string' && value in SEVERITY_RANK
        ? SEVERITY_RANK[value as AriadaSeverity]
        : SEVERITY_RANK.moderate;
}
function unwrap(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object')
        return {};
    const record = value as Record<string, unknown>;
    const result = record['result'];
    return result && typeof result === 'object' ? result as Record<string, unknown> : record;
}
function extractViolations(value: unknown): AriadaFinding[] {
    let current: unknown = value;
    if (current && typeof current === 'object' && 'result' in current)
        current = (current as Record<string, unknown>)['result'];
    if (current && typeof current === 'object' && 'result' in current)
        current = (current as Record<string, unknown>)['result'];
    const axe = current && typeof current === 'object' && 'value' in current ? (current as Record<string, unknown>)['value'] : current;
    const violations = axe && typeof axe === 'object' && 'violations' in axe ? (axe as Record<string, unknown>)['violations'] : [];
    if (!Array.isArray(violations))
        return [];
    return violations.map((item) => {
        const finding = (item ?? {}) as Record<string, unknown>;
        const tagsValue = finding['tags'];
        const tags = Array.isArray(tagsValue) ? tagsValue : [];
        const criterionTag = tags.find((tag): tag is string => typeof tag === 'string' && /^wcag\d+$/i.test(tag));
        const findingNodes = finding['nodes'];
        const firstNode = Array.isArray(findingNodes) ? findingNodes[0] : undefined;
        const target = (firstNode as Record<string, unknown> | undefined)?.['target'];
        return {
            ruleId: String(finding['id'] ?? 'unknown-rule'),
            severity: String(finding['impact'] ?? 'moderate'),
            message: String(finding['help'] ?? 'Accessibility violation'),
            ...(criterionTag ? { criterion: criterionTag.replace(/^wcag/i, '') } : {}),
            ...(firstNode ? { element: { selector: Array.isArray(target) ? String(target[0] ?? '') : String(target ?? '') }, nodes: findingNodes as unknown[] } : {}),
        };
    });
}
function flattenFindings(value: unknown): AriadaFinding[] {
    if (value === undefined)
        return [];
    return Array.isArray(value) ? value as AriadaFinding[] : Object.values(value as Record<string, AriadaFinding[]>).flat();
}
