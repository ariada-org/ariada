import type { AriadaScanResult } from './types.js';

/** Builds a Teams Adaptive Card from an Ariada CLI scan result. */
export function buildAdaptiveCard(result: AriadaScanResult): object {
  const statusText = result.status === 'pass' ? 'PASS' : 'FAIL';
  const topFindings = result.violations.slice(0, 5).map((violation) => ({
    type: 'TextBlock',
    wrap: true,
    text: `${violation.impact.toUpperCase()}: ${violation.id} - ${violation.description}`,
  }));

  return {
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: `Ariada accessibility gate: ${statusText}`,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Target', value: result.url },
          { title: 'Violations', value: String(result.summary.violations) },
          { title: 'Passes', value: String(result.summary.passes) },
        ],
      },
      ...topFindings,
    ],
    actions: result.reportUrl
      ? [{ type: 'Action.OpenUrl', title: 'Open full report', url: result.reportUrl }]
      : [],
  };
}
