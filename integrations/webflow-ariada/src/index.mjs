// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export const DEFAULT_DOMAINS = ['accessibility'];
export const DEFAULT_SEVERITY_THRESHOLD = 'serious';
export const WEBFLOW_SOURCE = 'webflow.designer-extension';

export function createWebflowOAuthUrl(options) {
  const clientId = requiredString(options?.clientId, 'clientId');
  const redirectUri = requiredHttpUrl(options?.redirectUri, 'redirectUri');
  const scopes = Array.isArray(options?.scopes) && options.scopes.length > 0
    ? options.scopes
    : ['sites:read', 'authorized_user:read'];
  const url = new URL('https://webflow.com/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(' '));
  if (options?.state) url.searchParams.set('state', String(options.state));
  return url.toString();
}

export function createWebflowScanRequest(input) {
  const pageUrl = requiredHttpUrl(input?.pageUrl, 'pageUrl');
  return {
    context: {
      locale: input?.locale ?? 'en',
      pageId: requiredString(input?.pageId, 'pageId'),
      siteId: requiredString(input?.siteId, 'siteId'),
    },
    domains: input?.domains ?? DEFAULT_DOMAINS,
    severityThreshold: input?.severityThreshold ?? DEFAULT_SEVERITY_THRESHOLD,
    source: WEBFLOW_SOURCE,
    url: pageUrl,
  };
}

export function normalizeAriadaFindings(report) {
  if (!report || typeof report !== 'object') return [];
  if (Array.isArray(report.findings)) return report.findings.map(toFindingRow);
  if (report.findings && typeof report.findings === 'object') {
    return Object.values(report.findings).flat().map(toFindingRow);
  }
  if (report.grid && typeof report.grid === 'object') {
    const rows = [];
    for (const site of Object.values(report.grid)) {
      if (!site || typeof site !== 'object') continue;
      for (const domain of Object.values(site)) {
        if (Array.isArray(domain)) rows.push(...domain.map(toFindingRow));
      }
    }
    return rows;
  }
  return [];
}

export function summarizeFindings(findings) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const finding of findings) {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  }
  return {
    counts,
    total: findings.length,
    worstSeverity: ['critical', 'serious', 'moderate', 'minor'].find((severity) => counts[severity] > 0) ?? 'none',
  };
}

export function buildPanelViewModel(input) {
  const findings = normalizeAriadaFindings(input?.report);
  const summary = summarizeFindings(findings);
  return {
    blocker: input?.blocker ?? null,
    findings,
    pageTitle: input?.pageTitle ?? 'Current Webflow page',
    scanRequest: createWebflowScanRequest(input),
    summary,
  };
}

function toFindingRow(value) {
  const row = value && typeof value === 'object' ? value : {};
  return {
    message: String(row.message ?? row.description ?? 'Ariada finding'),
    ruleId: String(row.ruleId ?? row.id ?? 'ariada/unknown'),
    selector: String(row.selector ?? row.target ?? 'document'),
    severity: asSeverity(row.severity ?? row.impact),
  };
}

function asSeverity(value) {
  return value === 'minor' || value === 'moderate' || value === 'critical' ? value : 'serious';
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required Webflow field: ${name}`);
  }
  return value;
}

function requiredHttpUrl(value, name) {
  const raw = requiredString(value, name);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
    return url.toString();
  } catch {
    throw new Error(`Webflow ${name} must be an http(s) URL`);
  }
}
