// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { buildCheckPayload, buildScanRequest, type VercelDeploymentReadyEvent } from '../src/handler.js';

const event: VercelDeploymentReadyEvent = {
  type: 'deployment.ready',
  deployment: {
    id: 'dpl_123',
    url: 'preview.example.vercel.app',
  },
};

describe('Vercel Ariada handler', () => {
  it('builds a hosted scan request from a deployment.ready event', () => {
    expect(buildScanRequest(event)).toEqual({
      url: 'https://preview.example.vercel.app',
      failOnSeverity: 'serious',
      deploymentId: 'dpl_123',
      provider: 'vercel',
    });
  });

  it('creates a failed check payload when findings meet the threshold', () => {
    const payload = buildCheckPayload(event, {
      total: 1,
      critical: 0,
      serious: 1,
      moderate: 0,
      minor: 0,
    });

    expect(payload.conclusion).toBe('failed');
    expect(payload.blocking).toBe(true);
    expect(payload.output.summary).toContain('1 findings');
  });
});
