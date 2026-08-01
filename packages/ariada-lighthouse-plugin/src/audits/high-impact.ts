// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Audit } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import { toAriadaHighImpactProduct } from '../adapter.js';
import { contextFromLighthouseUrl, loadAriadaScanOutput } from '../provider.js';
import type { AriadaAuditArtifacts } from './conformance.js';
export class AriadaHighImpactAudit extends Audit {
    static override get meta(): LH.Audit.Meta {
        return {
            id: 'ariada-high-impact-findings',
            title: 'Ariada scan has no high-impact findings',
            failureTitle: 'Ariada scan found high-impact issues',
            description: 'Fails when Ariada reports critical or serious findings and lists the affected rules and elements.',
            requiredArtifacts: ['URL'],
            scoreDisplayMode: 'binary',
            supportedModes: ['navigation'],
            guidanceLevel: 3,
        };
    }
    static override async audit(artifacts: AriadaAuditArtifacts): Promise<LH.Audit.Product> {
        const context = contextFromLighthouseUrl(artifacts.URL);
        const output = await loadAriadaScanOutput(context);
        return toAriadaHighImpactProduct(output);
    }
}
export default AriadaHighImpactAudit;
