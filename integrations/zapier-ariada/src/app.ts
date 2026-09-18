// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2

import type { AriadaReport, ZapierAppDefinition } from './contracts';
import { mapScanCompleted, mapViolations, parseReport } from './mapper';

/**
 * The report inside a platform bundle, wherever the platform put it.
 *
 * A hook delivers the body under `cleanedRequest`; a test run delivers it under
 * `inputData`; an older shape put it under `request.data`. Reading all three in
 * order costs one line and spares the integration a class of report that arrives
 * intact and is thrown away for being in the wrong pocket.
 */
const reportFromBundle = (bundle: {
  cleanedRequest?: unknown;
  inputData?: unknown;
  request?: { data?: unknown };
}): AriadaReport => parseReport(bundle.cleanedRequest ?? bundle.inputData ?? bundle.request?.data ?? {});

const app: ZapierAppDefinition = {
  version: '0.1.0',
  platformVersion: '17.0.0',
  authentication: {
    type: 'custom',
    fields: [{ key: 'webhook_url', label: 'Ariada webhook URL', type: 'string', required: true }],
    test: { url: '{{bundle.authData.webhook_url}}', method: 'GET' },
  },
  triggers: {
    // One event per finding rather than one per report. A person building an
    // automation wants a row they can act on, and a report with forty findings
    // is not one of those.
    newViolation: {
      key: 'new_violation',
      noun: 'Violation',
      display: {
        label: 'New accessibility violation',
        description: 'Emits each finding from an Ariada report.',
      },
      operation: {
        type: 'hook',
        perform: (_z: unknown, bundle: Parameters<typeof reportFromBundle>[0]) =>
          mapViolations(reportFromBundle(bundle)),
        sample: {
          id: 'scan-42-fp-1-0',
          fingerprint: 'fp-1',
          scanId: '42',
          ruleId: 'color-contrast',
          title: 'Insufficient contrast',
          description: 'Text does not meet contrast requirements.',
          severity: 'serious',
          url: 'https://example.test/',
          selector: '#main',
          wcag: '1.4.3',
          remediation: 'Increase contrast.',
          reportUrl: 'https://example.test/reports/42',
        },
        // Derived from one list rather than written twice: the fields a row has
        // and the fields the platform is told about cannot drift apart if there
        // is only one place to change.
        outputFields: [
          'id', 'fingerprint', 'scanId', 'ruleId', 'title', 'description',
          'severity', 'url', 'selector', 'wcag', 'remediation', 'reportUrl',
        ].map((key) => ({ key })),
      },
    },
    scanCompleted: {
      key: 'scan_completed',
      noun: 'Scan',
      display: {
        label: 'Scan completed',
        description: 'Emits the gate result and finding counts for an Ariada report.',
      },
      operation: {
        type: 'hook',
        perform: (_z: unknown, bundle: Parameters<typeof reportFromBundle>[0]) => [
          mapScanCompleted(reportFromBundle(bundle)),
        ],
        sample: {
          id: 'scan-42',
          scanId: '42',
          url: 'https://example.test/',
          reportUrl: 'https://example.test/reports/42',
          passed: false,
          findingCount: 1,
          criticalCount: 0,
          completedAt: '2026-06-22T12:00:00.000Z',
        },
        outputFields: [
          'id', 'scanId', 'url', 'reportUrl', 'passed',
          'findingCount', 'criticalCount', 'completedAt',
        ].map((key) => ({ key })),
      },
    },
  },
  actions: {
    runScan: {
      key: 'run_scan',
      noun: 'Scan',
      display: {
        label: 'Run Ariada scan',
        description: 'Starts a scan through the configured Ariada webhook.',
      },
      operation: {
        inputFields: [{ key: 'url', label: 'URL', type: 'string', required: true }],
        perform: async (
          z: { request: (options: unknown) => Promise<{ json: unknown }> },
          bundle: { authData: { webhook_url: string }; inputData: { url: string } },
        ) => {
          const response = await z.request({
            url: bundle.authData.webhook_url,
            method: 'POST',
            body: { url: bundle.inputData.url },
          });
          return response.json;
        },
        sample: { accepted: true, url: 'https://example.test/' },
        outputFields: [{ key: 'accepted' }, { key: 'url' }, { key: 'scanId' }],
      },
    },
  },
};

export = app;
