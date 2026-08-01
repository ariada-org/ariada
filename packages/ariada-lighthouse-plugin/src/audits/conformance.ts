// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Audit } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import { toAriadaConformanceProduct } from '../adapter.js';
import {
    contextFromLighthouseUrl,
    loadAriadaScanOutput,
    type LighthouseUrlArtifact,
} from '../provider.js';

export interface AriadaAuditArtifacts {
    readonly URL: LighthouseUrlArtifact;
}

export class AriadaConformanceAudit extends Audit {
    static override get meta(): LH.Audit.Meta {
        return {
            id: 'ariada-conformance',
            title: 'Ariada scan has no findings',
            failureTitle: 'Ariada scan found conformance issues',
            description: 'Adapts Ariada scanner findings into a severity-aware Lighthouse score and a deterministic findings table.',
            requiredArtifacts: ['URL'],
            scoreDisplayMode: 'numeric',
            supportedModes: ['navigation'],
            guidanceLevel: 3,
        };
    }
    static override async audit(artifacts: AriadaAuditArtifacts): Promise<LH.Audit.Product> {
        const context = contextFromLighthouseUrl(artifacts.URL);
        const output = await loadAriadaScanOutput(context);
        return toAriadaConformanceProduct(output);
    }
}
export default AriadaConformanceAudit;
