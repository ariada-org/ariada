import type { AriadaScanEnvelope, ZeplinPanelResult, ZeplinSnapshot } from './types.js';
export declare function renderZeplinScanTarget(snapshot: ZeplinSnapshot): string;
export declare function buildZeplinExtensionSnippet(snapshot: ZeplinSnapshot): {
    code: string;
    language: 'json';
};
export declare function summarizeAriadaScan(snapshot: ZeplinSnapshot, envelope?: AriadaScanEnvelope): ZeplinPanelResult;
//# sourceMappingURL=adapter.d.ts.map