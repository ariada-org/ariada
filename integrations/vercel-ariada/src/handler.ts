// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 *
 */
export interface VercelDeploymentReadyEvent {
  type: 'deployment.ready';
  deployment: {
    id: string;
    url: string;
    meta?: Record<string, string | undefined>;
  };
  teamId?: string;
}

/**
 *
 */
export interface VercelCheckPayload {
  deploymentId: string;
  name: string;
  blocking: boolean;
  status: 'running' | 'completed';
  conclusion?: 'passed' | 'failed';
  output: {
    title: string;
    summary: string;
    text: string;
  };
}

/**
 *
 */
export interface ScanSummary {
  total: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

const severityRank = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
} as const;

type Severity = keyof typeof severityRank;

function rankForSeverity(value: string): number {
  return value in severityRank ? severityRank[value as Severity] : severityRank.serious;
}

/**
 *
 */
export function buildScanRequest(event: VercelDeploymentReadyEvent, failOnSeverity = 'serious') {
  return {
    url: event.deployment.url.startsWith('http')
      ? event.deployment.url
      : `https://${event.deployment.url}`,
    failOnSeverity,
    deploymentId: event.deployment.id,
    provider: 'vercel',
  };
}

/**
 *
 */
export function buildCheckPayload(
  event: VercelDeploymentReadyEvent,
  summary: ScanSummary,
  failOnSeverity = 'serious',
): VercelCheckPayload {
  const threshold = rankForSeverity(failOnSeverity);
  const failed =
    (summary.critical > 0 && severityRank.critical >= threshold) ||
    (summary.serious > 0 && severityRank.serious >= threshold) ||
    (summary.moderate > 0 && severityRank.moderate >= threshold) ||
    (summary.minor > 0 && severityRank.minor >= threshold);

  return {
    deploymentId: event.deployment.id,
    name: 'Ariada accessibility check',
    blocking: true,
    status: 'completed',
    conclusion: failed ? 'failed' : 'passed',
    output: {
      title: failed ? 'Ariada found blocking accessibility findings' : 'Ariada accessibility check passed',
      summary: `${summary.total} findings: ${summary.critical} critical, ${summary.serious} serious, ${summary.moderate} moderate, ${summary.minor} minor.`,
      text: `Threshold: ${failOnSeverity}. Deployment: ${event.deployment.url}.`,
    },
  };
}
