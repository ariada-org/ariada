// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { expect as baseExpect, test as base, type Page, type TestInfo } from '@playwright/test';
import { createCompleteArtifact, createErrorArtifact, serializeAriadaArtifact } from './artifact.js';
import { scanPage } from './scan-adapter.js';
import { ARIADA_ATTACHMENT_CONTENT_TYPE, ARIADA_ATTACHMENT_NAME, type AriadaScanOptions, type AriadaScanResult } from './types.js';

export type AriadaAutoScanMode = false | 'soft' | 'hard';
export interface AriadaFixtureOptions {
    readonly autoScan?: AriadaAutoScanMode;
    readonly severityThreshold?: AriadaScanOptions['severityThreshold'];
}
export interface AriadaFixture {
    scan(page: Page, options?: AriadaScanOptions): Promise<AriadaScanResult>;
}
type ScanImplementation = (page: Page, options?: AriadaScanOptions) => Promise<AriadaScanResult>;

export class AriadaScanBlockedError extends Error {
    override readonly name = 'AriadaScanBlockedError';
    constructor(message: string, options?: ErrorOptions) { super(message, options); }
}
export function toHaveNoBlockingViolations(received: AriadaScanResult): { pass: boolean; message: () => string } { const blocking = received.policy.blockingFindings; const pass = blocking.length === 0; const detail = blocking.slice(0, 20).map((f) => `  ${f.ruleId} [${f.severity}] ${f.element.selector}: ${f.message}`).join('\n'); return { pass, message: () => pass ? `Expected Ariada report to contain a violation at or above ${received.policy.threshold}, but none was found.` : `Expected no Ariada violations at or above ${received.policy.threshold}; found ${blocking.length}:\n${detail}${blocking.length > 20 ? `\n  ... and ${blocking.length - 20} more` : ''}` }; }
export const expect: import("@playwright/test").Expect<{
    toHaveNoBlockingViolations: typeof toHaveNoBlockingViolations;
}> = baseExpect.extend({ toHaveNoBlockingViolations });
export function createAriadaFixture(testInfo: TestInfo, defaults: AriadaFixtureOptions = {}, scan: ScanImplementation = scanPage): AriadaFixture { let index = 0; return { async scan(page, options = {}) { index += 1; const merged = { ...options, scanId: options.scanId ?? `${testInfo.testId}-${index}`, ...(options.severityThreshold === undefined && defaults.severityThreshold !== undefined ? { severityThreshold: defaults.severityThreshold } : {}) }; try {
        const result = await scan(page, merged);
        await attachArtifact(testInfo, serializeAriadaArtifact(createCompleteArtifact(result)));
        return result;
    }
    catch (error) {
        await attachArtifact(testInfo, serializeAriadaArtifact(createErrorArtifact(error)));
        throw new AriadaScanBlockedError(`Ariada scan could not complete: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    } } }; }
interface AriadaTestFixtures { ariada: AriadaFixture; ariadaOptions: AriadaFixtureOptions }
export const test: import("@playwright/test").TestType<
    import("@playwright/test").PlaywrightTestArgs &
        import("@playwright/test").PlaywrightTestOptions &
        AriadaTestFixtures,
    import("@playwright/test").PlaywrightWorkerArgs &
        import("@playwright/test").PlaywrightWorkerOptions
> = base.extend<AriadaTestFixtures>({ ariadaOptions: [{ autoScan: false }, { option: true }], ariada: async ({ page, ariadaOptions }, use, testInfo) => { const fixture = createAriadaFixture(testInfo, ariadaOptions); await use(fixture); if (ariadaOptions.autoScan !== false && ariadaOptions.autoScan !== undefined) {
        const result = await fixture.scan(page);
        if (ariadaOptions.autoScan === 'soft')
            expect.soft(result).toHaveNoBlockingViolations();
        else
            expect(result).toHaveNoBlockingViolations();
    } } });
async function attachArtifact(testInfo: TestInfo, serialized: string): Promise<void> { await testInfo.attach(ARIADA_ATTACHMENT_NAME, { body: Buffer.from(serialized, 'utf8'), contentType: ARIADA_ATTACHMENT_CONTENT_TYPE }); }
