// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'];

const SEVERITY_RANK = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeSeverity(value = 'serious') {
  if (!SEVERITIES.includes(value)) {
    throw new Error(`Unsupported severity threshold: ${value}`);
  }
  return value;
}

export function buildAriadaInvocation(options) {
  const {
    targetUrl,
    reportDir = 'ariada-output',
    severity = 'serious',
    format = 'json',
    timeoutMs = 30_000,
    allowPrivate = false,
    cliBin = 'npx',
  } = options;

  if (!targetUrl || !isHttpUrl(targetUrl)) {
    throw new Error(`GitBook Ariada target must be an http(s) URL: ${targetUrl ?? ''}`);
  }

  const args = cliBin === 'npx' ? ['@ariada-org/cli'] : [];
  args.push(
    'scan',
    targetUrl,
    '--severity-threshold',
    normalizeSeverity(severity),
    '--format',
    format,
    '--output-dir',
    reportDir,
    '--timeout-ms',
    String(timeoutMs),
  );
  if (allowPrivate) args.push('--allow-private');

  return {
    command: cliBin,
    args,
  };
}

export function flattenFindings(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.values(value).flatMap((entry) => flattenFindings(entry));
  }
  return [];
}

export function summarizeScanEnvelope(payload, threshold = 'serious') {
  const report = payload.report ?? payload;
  const findings = flattenFindings(report.findings);
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };

  for (const finding of findings) {
    const severity = typeof finding?.severity === 'string' ? finding.severity : 'moderate';
    if (severity in counts) counts[severity] += 1;
  }

  const thresholdRank = SEVERITY_RANK[normalizeSeverity(threshold)];
  const failed = findings.some((finding) => {
    const severity = typeof finding?.severity === 'string' ? finding.severity : 'moderate';
    return (SEVERITY_RANK[severity] ?? SEVERITY_RANK.moderate) >= thresholdRank;
  });

  return {
    total: findings.length,
    counts,
    failed,
    findings,
  };
}
