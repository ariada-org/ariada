// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type * as LH from 'lighthouse/types/lh.js';

export const audits: NonNullable<LH.Config.Plugin['audits']> = [
    { path: '@ariada-org/lighthouse-plugin/audits/conformance.js' },
    { path: '@ariada-org/lighthouse-plugin/audits/high-impact.js' },
];
export const category: LH.Config.Plugin['category'] = {
    title: 'Ariada',
    description: 'Accessibility and cross-domain conformance results produced by the Ariada scanner.',
    supportedModes: ['navigation'],
    auditRefs: [
        { id: 'ariada-conformance', weight: 2, group: 'conformance' },
        { id: 'ariada-high-impact-findings', weight: 1, group: 'high-impact' },
    ],
};
export const groups: NonNullable<LH.Config.Plugin['groups']> = {
    conformance: {
        title: 'Conformance findings',
        description: 'All findings returned by the configured Ariada scan boundary.',
    },
    'high-impact': {
        title: 'High-impact findings',
        description: 'Critical and serious Ariada findings that require priority remediation.',
    },
};
const plugin: LH.Config.Plugin = { audits, category, groups };
export { ARIADA_DETAIL_HEADINGS, extractAriadaReport, flattenAriadaFindings, scoreAriadaFindings, toAriadaConformanceProduct, toAriadaHighImpactProduct, } from './adapter.js';
export { AriadaConformanceAudit } from './audits/conformance.js';
export { AriadaHighImpactAudit } from './audits/high-impact.js';
export {
    ARIADA_SCAN_OUTPUT_ENV,
    configureAriadaScanOutput,
    configureAriadaScanProvider,
    contextFromLighthouseUrl,
    createFileScanProvider,
    createScannerProvider,
    loadAriadaScanOutput,
    resetAriadaScanProvider,
    type LighthouseUrlArtifact,
} from './provider.js';
export {
    ARIADA_SEVERITIES,
    type AriadaCliScanEnvelope,
    type AriadaElementReference,
    type AriadaFinding,
    type AriadaRegulatoryReference,
    type AriadaReport,
    type AriadaScanContext,
    type AriadaScanFunction,
    type AriadaScanOptionsFactory,
    type AriadaScanOutput,
    type AriadaScanProvider,
    type AriadaScanResult,
    type AriadaSeverity,
} from './types.js';
export default plugin;
