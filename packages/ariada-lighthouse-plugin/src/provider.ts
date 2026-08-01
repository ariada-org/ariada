// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import type {
    AriadaScanContext,
    AriadaScanFunction,
    AriadaScanOptionsFactory,
    AriadaScanOutput,
    AriadaScanProvider,
} from './types.js';

export const ARIADA_SCAN_OUTPUT_ENV = 'ARIADA_LIGHTHOUSE_SCAN_OUTPUT';

export interface LighthouseUrlArtifact {
    readonly requestedUrl?: string;
    readonly mainDocumentUrl?: string;
    readonly finalDisplayedUrl?: string;
}

let configuredProvider: AriadaScanProvider | undefined;
let outputCache = new Map<string, Promise<AriadaScanOutput>>();
function clearOutputCache(): void {
    outputCache = new Map<string, Promise<AriadaScanOutput>>();
}
export function configureAriadaScanProvider(provider: AriadaScanProvider): void {
    configuredProvider = provider;
    clearOutputCache();
}
export function configureAriadaScanOutput(output: AriadaScanOutput): void {
    configureAriadaScanProvider(() => output);
}
export function resetAriadaScanProvider(): void {
    configuredProvider = undefined;
    clearOutputCache();
}
export function createFileScanProvider(path: string | URL): AriadaScanProvider {
    return async () => {
        const contents = await readFile(path, 'utf8');
        return JSON.parse(contents);
    };
}
export function createScannerProvider<TOptions>(
    scan: AriadaScanFunction<TOptions>,
    options?: TOptions | AriadaScanOptionsFactory<TOptions>,
): AriadaScanProvider {
    return (context) => {
        const resolvedOptions = typeof options === 'function'
            ? (options as AriadaScanOptionsFactory<TOptions>)(context)
            : options;
        return scan(context.finalDisplayedUrl, resolvedOptions);
    };
}
export function contextFromLighthouseUrl(url: LighthouseUrlArtifact): AriadaScanContext {
    const finalDisplayedUrl = url.finalDisplayedUrl ?? url.mainDocumentUrl ?? url.requestedUrl;
    if (!finalDisplayedUrl) {
        throw new TypeError('Lighthouse URL artifact does not contain a target URL.');
    }
    return {
        requestedUrl: url.requestedUrl ?? finalDisplayedUrl,
        mainDocumentUrl: url.mainDocumentUrl ?? finalDisplayedUrl,
        finalDisplayedUrl,
    };
}
async function environmentScanProvider(): Promise<AriadaScanOutput> {
    const source = process.env[ARIADA_SCAN_OUTPUT_ENV];
    if (!source) {
        throw new Error(`No Ariada scan output configured. Set ${ARIADA_SCAN_OUTPUT_ENV} to a CLI scan.json path or call configureAriadaScanProvider().`);
    }
    const trimmed = source.trim();
    if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed);
    }
    return createFileScanProvider(source)({
        requestedUrl: '',
        mainDocumentUrl: '',
        finalDisplayedUrl: '',
    });
}
export async function loadAriadaScanOutput(context: AriadaScanContext): Promise<AriadaScanOutput> {
    const cacheKey = context.finalDisplayedUrl;
    const cached = outputCache.get(cacheKey);
    if (cached)
        return cached;
    const provider = configuredProvider ?? environmentScanProvider;
    const pending = Promise.resolve().then(() => provider(context));
    outputCache.set(cacheKey, pending);
    try {
        return await pending;
    }
    catch (error) {
        if (outputCache.get(cacheKey) === pending)
            outputCache.delete(cacheKey);
        throw error;
    }
}
