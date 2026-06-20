// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { UnifiedReport } from '@ariada-org/core-engine';

/** The host element ID for the injected overlay. */
const OVERLAY_HOST_ID = 'ariada-scan-overlay-host';

/**
 * Regulatory mapping for common WCAG success criteria to EN 301 549 clauses.
 * EN 301 549 (European accessibility standard for ICT, Annex A, 2021) maps
 * Web content requirements through WCAG 2.1/2.2 clauses.
 */
const WCAG_TO_EN: Record<string, string> = {
  'WCAG 1.1.1': '9.1.1.1',
  'WCAG 1.2.1': '9.1.2.1',
  'WCAG 1.2.2': '9.1.2.2',
  'WCAG 1.2.3': '9.1.2.3',
  'WCAG 1.2.4': '9.1.2.4',
  'WCAG 1.2.5': '9.1.2.5',
  'WCAG 1.3.1': '9.1.3.1',
  'WCAG 1.3.2': '9.1.3.2',
  'WCAG 1.3.3': '9.1.3.3',
  'WCAG 1.3.4': '9.1.3.4',
  'WCAG 1.3.5': '9.1.3.5',
  'WCAG 1.4.1': '9.1.4.1',
  'WCAG 1.4.2': '9.1.4.2',
  'WCAG 1.4.3': '9.1.4.3',
  'WCAG 1.4.4': '9.1.4.4',
  'WCAG 1.4.5': '9.1.4.5',
  'WCAG 1.4.10': '9.1.4.10',
  'WCAG 1.4.11': '9.1.4.11',
  'WCAG 1.4.12': '9.1.4.12',
  'WCAG 1.4.13': '9.1.4.13',
  'WCAG 2.1.1': '9.2.1.1',
  'WCAG 2.1.2': '9.2.1.2',
  'WCAG 2.1.4': '9.2.1.4',
  'WCAG 2.2.1': '9.2.2.1',
  'WCAG 2.2.2': '9.2.2.2',
  'WCAG 2.3.1': '9.2.3.1',
  'WCAG 2.4.1': '9.2.4.1',
  'WCAG 2.4.2': '9.2.4.2',
  'WCAG 2.4.3': '9.2.4.3',
  'WCAG 2.4.4': '9.2.4.4',
  'WCAG 2.4.5': '9.2.4.5',
  'WCAG 2.4.6': '9.2.4.6',
  'WCAG 2.4.7': '9.2.4.7',
  'WCAG 2.5.1': '9.2.5.1',
  'WCAG 2.5.2': '9.2.5.2',
  'WCAG 2.5.3': '9.2.5.3',
  'WCAG 2.5.4': '9.2.5.4',
  'WCAG 3.1.1': '9.3.1.1',
  'WCAG 3.1.2': '9.3.1.2',
  'WCAG 3.2.1': '9.3.2.1',
  'WCAG 3.2.2': '9.3.2.2',
  'WCAG 3.3.1': '9.3.3.1',
  'WCAG 3.3.2': '9.3.3.2',
  'WCAG 4.1.1': '9.4.1.1',
  'WCAG 4.1.2': '9.4.1.2',
  'WCAG 4.1.3': '9.4.1.3',
};

/** CSS injected into the shadow root. */
const OVERLAY_STYLES = `
  :host {
    all: initial;
  }
  /* ── Layout shell ──────────────────────────────────────────── */
  .overlay {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 2147483647;
    background: #1a1a2e;
    color: #e0e0e0;
    border: 2px solid #4a9eff;
    border-radius: 8px;
    padding: 0;
    min-width: 260px;
    /* Responsive: never wider than viewport minus 2rem gutters */
    max-width: min(420px, calc(100vw - 2rem));
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 4rem);
  }
  /* Bottom-sheet on narrow screens (< 480px) */
  @media (max-width: 480px) {
    .overlay {
      position: fixed;
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: 100%;
      border-radius: 8px 8px 0 0;
      max-height: 70vh;
    }
  }
  /* Print stylesheet — flat readable list */
  @media print {
    .overlay {
      position: static;
      border: 1px solid #000;
      box-shadow: none;
      max-height: none;
      background: #fff;
      color: #000;
      max-width: 100%;
      border-radius: 0;
    }
    .close-btn { display: none; }
    .domain-body { display: block !important; }
    details { border: none !important; }
    summary { font-weight: bold; }
    .reg-badge { border: 1px solid #000; }
    .score-band { border: 2px solid #000; }
  }

  /* ── Header ────────────────────────────────────────────────── */
  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #2a2a4a;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .overlay-title {
    font-weight: 700;
    font-size: 15px;
    color: #4a9eff;
  }
  /* Close button — 44×44px touch target, 3:1 border contrast (#6e6e6e vs #1a1a2e ≈ 3.3:1) */
  .close-btn {
    background: transparent;
    border: 1px solid #6e6e6e;
    color: #e0e0e0;
    border-radius: 4px;
    cursor: pointer;
    /* Minimum 44×44px touch target (WCAG 2.2 SC 2.5.8) */
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    line-height: 1;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .close-btn:hover,
  .close-btn:focus {
    background: #2a2a4a;
    outline: 2px solid #4a9eff;
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .close-btn { transition: none; }
  }

  /* ── Score headline ─────────────────────────────────────────── */
  .score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem 0.5rem;
    border-bottom: 1px solid #2a2a4a;
    flex-shrink: 0;
  }
  .score-label {
    font-size: 12px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .score-value {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .score-number {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
  }
  .score-band {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .band-a    { background: #15803d; color: #dcfce7; }
  .band-b    { background: #166534; color: #bbf7d0; }
  .band-c    { background: #854d0e; color: #fef9c3; }
  .band-d    { background: #9a3412; color: #ffedd5; }
  .band-fail { background: #7f1d1d; color: #fee2e2; }
  .score-color-a { color: #4ade80; }
  .score-color-b { color: #86efac; }
  .score-color-c { color: #fbbf24; }
  .score-color-d { color: #fb923c; }
  .score-color-fail { color: #f87171; }

  /* ── Coverage note ──────────────────────────────────────────── */
  .coverage-note {
    font-size: 11px;
    color: #94a3b8;
    padding: 0.35rem 1rem;
    border-bottom: 1px solid #2a2a4a;
    flex-shrink: 0;
  }

  /* ── Scrollable body with scroll-shadow affordance ─────────── */
  .overlay-body {
    overflow-y: auto;
    padding: 0.5rem 0;
    flex: 1 1 auto;
    /* Scroll-shadow: subtle gradient hints at scrollable content */
    background:
      linear-gradient(#1a1a2e 30%, rgba(26, 26, 46, 0)) top / 100% 16px no-repeat,
      linear-gradient(rgba(26, 26, 46, 0), #1a1a2e 70%) bottom / 100% 16px no-repeat,
      linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)) top / 100% 16px no-repeat,
      linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)) bottom / 100% 16px no-repeat;
    background-attachment: local, local, scroll, scroll;
  }

  /* ── Domain rows + expandable findings ─────────────────────── */
  .domain-section {
    border-bottom: 1px solid #2a2a4a;
  }
  .domain-section:last-child { border-bottom: none; }

  .domain-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    cursor: pointer;
    list-style: none;
    gap: 0.5rem;
    min-height: 44px; /* touch target */
  }
  .domain-summary::-webkit-details-marker { display: none; }
  .domain-summary:focus {
    outline: 2px solid #4a9eff;
    outline-offset: -2px;
  }
  .domain-name {
    text-transform: capitalize;
    font-weight: 600;
    flex: 1;
  }
  .domain-chevron {
    font-size: 10px;
    color: #94a3b8;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .domain-chevron { transition: none; }
  }
  details[open] .domain-chevron { transform: rotate(90deg); }

  .finding-counts {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .badge {
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.4;
  }
  .badge-critical { background: #c0392b; color: #fff; }
  .badge-serious  { background: #e67e22; color: #fff; }
  .badge-moderate { background: #f39c12; color: #000; }
  .badge-minor    { background: #2ecc71; color: #000; }
  /* #c8c8c8 on #333 ≈ 5.8:1 — passes AA (previously #aaa on #333 was ~3.1:1) */
  .badge-zero     { background: #333; color: #c8c8c8; }

  /* ── Individual finding items ───────────────────────────────── */
  .domain-body {
    padding: 0 0.5rem 0.5rem;
  }
  .finding-item {
    background: #12122a;
    border: 1px solid #2a2a4a;
    border-radius: 4px;
    margin: 0.25rem 0;
    padding: 0.5rem 0.75rem;
    font-size: 12px;
  }
  .finding-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.3rem;
    flex-wrap: wrap;
  }
  .finding-rule {
    font-weight: 700;
    color: #7dd3fc;
    font-family: monospace;
    font-size: 11px;
  }
  .finding-message {
    color: #cbd5e1;
    margin-bottom: 0.35rem;
    line-height: 1.4;
  }
  .finding-selector {
    font-family: monospace;
    font-size: 10px;
    color: #94a3b8;
    background: #0a0a1e;
    padding: 2px 4px;
    border-radius: 3px;
    word-break: break-all;
    margin-bottom: 0.35rem;
    display: block;
  }
  .reg-badges {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    margin-top: 0.3rem;
  }
  .reg-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
  }
  .reg-badge-wcag { background: #1e3a5f; color: #93c5fd; }
  .reg-badge-en   { background: #1a3a2a; color: #86efac; }
  .highlight-btn {
    background: transparent;
    border: 1px solid #4a9eff;
    color: #4a9eff;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    cursor: pointer;
    margin-top: 0.25rem;
    min-height: 28px;
    min-width: 28px;
  }
  .highlight-btn:hover,
  .highlight-btn:focus {
    background: #1e3a5f;
    outline: 2px solid #4a9eff;
    outline-offset: 2px;
  }

  /* ── Loading state ──────────────────────────────────────────── */
  .state-scanning {
    text-align: center;
    padding: 1.5rem 1rem;
    color: #94a3b8;
  }
  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #2a2a4a;
    border-top-color: #4a9eff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 0.5rem;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-color: #4a9eff;
    }
  }

  /* ── Empty state ────────────────────────────────────────────── */
  .state-empty {
    text-align: center;
    padding: 1.5rem 1rem;
    color: #94a3b8;
  }
  .state-empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
    color: #4ade80;
  }
  .state-empty-title {
    font-weight: 700;
    color: #e0e0e0;
    margin-bottom: 0.25rem;
  }
  .state-empty-desc {
    font-size: 12px;
    color: #94a3b8;
  }

  /* ── Error state ────────────────────────────────────────────── */
  .state-error {
    padding: 1rem;
    background: #2d0a0a;
    border-top: 1px solid #7f1d1d;
    border-bottom: 1px solid #7f1d1d;
    color: #fca5a5;
    font-size: 12px;
  }
  .state-error-title {
    font-weight: 700;
    color: #f87171;
    margin-bottom: 0.3rem;
  }
`;

/** Severity ordering for score calculation (critical=worst). */
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
};

/**
 * Compute a 0–100 compliance score from the findings.
 * Higher score = fewer/less severe violations.
 * Returns { score, band } where band is 'A' | 'B' | 'C' | 'D' | 'FAIL'.
 */
function computeScore(findings: UnifiedReport['findings']): { score: number; band: string } {
  let totalWeight = 0;
  for (const domainFindings of Object.values(findings)) {
    for (const f of domainFindings) {
      totalWeight += SEVERITY_WEIGHTS[f.severity] ?? 1;
    }
  }
  // Score decays logarithmically: 0 issues = 100, severe issues approach 0.
  const raw = totalWeight === 0 ? 100 : Math.max(0, Math.round(100 - Math.log1p(totalWeight) * 15));
  const score = Math.min(100, raw);
  let band: string;
  if (score >= 90) band = 'A';
  else if (score >= 75) band = 'B';
  else if (score >= 50) band = 'C';
  else if (score >= 25) band = 'D';
  else band = 'FAIL';
  return { score, band };
}

/**
 * Counts findings per severity level for a single domain.
 */
function countBySeverity(findings: { severity: string }[]): Record<string, number> {
  const counts: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const f of findings) {
    const s = f.severity;
    if (s in counts) counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

/** Escape HTML to prevent XSS when rendering user data into the shadow DOM. */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build regulatory mapping badges for a WCAG criterion string. */
function buildRegBadges(criterion: string): string {
  if (!criterion) return '';
  const enClause = WCAG_TO_EN[criterion];
  const wcagBadge = `<span class="reg-badge reg-badge-wcag" title="WCAG 2.2 Success Criterion">${esc(criterion)}</span>`;
  const enBadge = enClause
    ? `<span class="reg-badge reg-badge-en" title="EN 301 549 clause (European accessibility standard for ICT)">EN ${esc(enClause)}</span>`
    : '';
  return `<div class="reg-badges" aria-label="Regulatory criteria">${wcagBadge}${enBadge}</div>`;
}

/** Build expandable finding rows for a domain. */
function buildFindingItems(
  findings: Array<{
    id: string;
    ruleId: string;
    severity: string;
    element: { selector: string };
    message: string;
    criterion?: string;
  }>,
): string {
  if (findings.length === 0) {
    return `<p class="state-empty-desc" role="note">No findings in this domain.</p>`;
  }
  return findings
    .map((f, idx) => {
      const criterion = (f as { criterion?: string }).criterion ?? '';
      const regBadges = buildRegBadges(criterion);
      const highlightAttr = f.element.selector
        ? ` data-highlight-selector="${esc(f.element.selector)}"`
        : '';
      return `
      <div class="finding-item" role="listitem" aria-label="Finding ${String(idx + 1)}: ${esc(f.ruleId)}">
        <div class="finding-header">
          <span class="badge badge-${esc(f.severity)}" aria-label="Severity: ${esc(f.severity)}">${esc(f.severity)}</span>
          <code class="finding-rule">${esc(f.ruleId)}</code>
        </div>
        <p class="finding-message">${esc(f.message)}</p>
        ${f.element.selector ? `<code class="finding-selector" aria-label="CSS selector: ${esc(f.element.selector)}">${esc(f.element.selector)}</code>` : ''}
        ${regBadges}
        ${f.element.selector ? `<button class="highlight-btn" type="button" aria-label="Highlight this element on the page"${highlightAttr}>Highlight on page</button>` : ''}
      </div>`;
    })
    .join('');
}

/**
 * Build the inner HTML for the overlay panel given a scan report.
 */
function buildOverlayContent(report: UnifiedReport): string {
  const domainEntries = Object.entries(report.findings);
  const { score, band } = computeScore(report.findings);
  const scoreColorClass = `score-color-${band.toLowerCase()}`;
  const scoreBandClass = `band-${band.toLowerCase()}`;

  const scoreHtml = `
    <div class="score-row" aria-label="Compliance score">
      <span class="score-label">Compliance score</span>
      <div class="score-value">
        <span class="score-number ${scoreColorClass}" aria-label="${String(score)} out of 100">${String(score)}</span>
        <span class="score-band ${scoreBandClass}" aria-label="Band ${band}">${band}</span>
      </div>
    </div>
    <p class="coverage-note" role="note">
      Automated checks cover approximately 35–57% of WCAG 2.2 AA requirements.
      Manual review is needed for the remainder.
    </p>`;

  if (domainEntries.length === 0) {
    return scoreHtml + `
      <div class="overlay-body" id="ariada-overlay-body" aria-live="polite">
        <div class="state-empty" role="note" aria-label="No findings detected">
          <span class="state-empty-icon" aria-hidden="true">✓</span>
          <p class="state-empty-title">All clear — no issues detected</p>
          <p class="state-empty-desc">
            No accessibility or compliance issues were found by the automated scan.
            Use manual testing to verify the remaining checks.
          </p>
        </div>
      </div>`;
  }

  const domainRows = domainEntries
    .map(([domain, findings]) => {
      const counts = countBySeverity(findings);
      const badgesHtml = Object.entries(counts)
        .filter(([, c]) => c > 0)
        .map(
          ([sev, c]) =>
            `<span class="badge badge-${sev}" aria-label="${String(c)} ${sev}">${String(c)} ${sev}</span>`,
        )
        .join('');
      const zeroBadge =
        Object.values(counts).every((c) => c === 0)
          ? '<span class="badge badge-zero">0 findings</span>'
          : '';
      const findingItems = buildFindingItems(
        findings as Array<{
          id: string;
          ruleId: string;
          severity: string;
          element: { selector: string };
          message: string;
          criterion?: string;
        }>,
      );
      return `
        <div class="domain-section">
          <details>
            <summary class="domain-summary">
              <span class="domain-name">${esc(domain)}</span>
              <span class="finding-counts">${badgesHtml || zeroBadge}</span>
              <span class="domain-chevron" aria-hidden="true">▶</span>
            </summary>
            <div class="domain-body" role="list" aria-label="${esc(domain)} findings">
              ${findingItems}
            </div>
          </details>
        </div>`;
    })
    .join('');

  return scoreHtml + `
    <div class="overlay-body" id="ariada-overlay-body" aria-live="polite">
      ${domainRows}
    </div>`;
}

/**
 * Build an error state panel.
 */
function buildErrorContent(message: string): string {
  return `
    <div class="overlay-body" id="ariada-overlay-body">
      <div class="state-error" role="alert" aria-live="assertive" aria-atomic="true">
        <p class="state-error-title">Scan failed</p>
        <p>${esc(message)}</p>
      </div>
    </div>`;
}

/**
 * Build a loading/scanning state panel.
 */
export function buildLoadingContent(): string {
  return `
    <div class="overlay-body" id="ariada-overlay-body">
      <div class="state-scanning" role="status" aria-live="polite" aria-label="Scanning in progress">
        <span class="spinner" aria-hidden="true"></span>
        <p>Scanning…</p>
      </div>
    </div>`;
}

/**
 * Inject a shadow-DOM overlay showing findings from the given report into
 * `targetDocument`. Returns the host element so callers can remove it or
 * track focus.
 *
 * The overlay uses a closed shadow root to avoid CSS bleed with the host page.
 * Keyboard accessibility: Tab navigates within the overlay; Escape dismisses;
 * click outside dismisses; focus returns to `returnFocusTo` on dismiss.
 *
 * Includes:
 * - 0–100 compliance score + band label (A/B/C/D/FAIL)
 * - Coverage estimate note (35–57% of WCAG 2.2 AA)
 * - Native <details>/<summary> drill-down per domain
 * - Per-finding: severity badge, ruleId, message, CSS selector, WCAG + EN 301 549 badges
 * - Highlight-on-page button per finding
 * - Accessible empty state (all-clear) and error state
 * - aria-live on body for screen reader announcements
 * - Scroll-shadow affordance on the body
 * - Print stylesheet
 * - Bottom-sheet layout on < 480px screens
 * - 44×44px close button touch target
 * - Correct contrast: border #6e6e6e (~3.3:1), badge-zero #c8c8c8 on #333 (~5.8:1)
 * - prefers-reduced-motion: transitions disabled
 */
export function showOverlay(
  report: UnifiedReport,
  targetDocument: Document,
  returnFocusTo: Element | null = null,
): HTMLElement {
  // Remove any existing overlay first.
  removeOverlay(targetDocument);

  const host = targetDocument.createElement('div');
  host.id = OVERLAY_HOST_ID;
  host.setAttribute('data-ariada-overlay', '1');

  // Shadow DOM v1: supported in all evergreen browsers since 2018. Guard for
  // old WebViews where attachShadow may be absent.
  const attachShadowFn = (host as unknown as Record<string, unknown>)['attachShadow'];
  if (typeof attachShadowFn !== 'function') {
    // Degrade: inject a plain positioned div into the document.
    host.style.cssText =
      'position:fixed;top:1rem;right:1rem;z-index:2147483647;background:#1a1a2e;color:#e0e0e0;border:2px solid #4a9eff;border-radius:8px;padding:1rem;font-family:sans-serif;font-size:14px;';
    targetDocument.body.appendChild(host);
    return host;
  }
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = targetDocument.createElement('style');
  style.textContent = OVERLAY_STYLES;

  const panel = targetDocument.createElement('div');
  panel.className = 'overlay';
  // Use aria-label instead of aria-labelledby because closed shadow root
  // prevents cross-boundary ID resolution in some screen readers.
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ariada compliance scan results');
  panel.setAttribute('aria-modal', 'false');

  const closeId = 'ariada-close-btn';
  panel.innerHTML = `
    <div class="overlay-header">
      <span class="overlay-title">Ariada Scan</span>
      <button class="close-btn" id="${closeId}" aria-label="Close scan results" type="button">✕</button>
    </div>
    ${buildOverlayContent(report)}
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  targetDocument.body.appendChild(host);

  const closeBtn = shadow.getElementById(closeId) as HTMLButtonElement | null;

  function dismiss(): void {
    removeOverlay(targetDocument);
    if (returnFocusTo instanceof HTMLElement) {
      returnFocusTo.focus();
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
    closeBtn.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    });
    // Auto-focus the close button so keyboard users can start navigating.
    closeBtn.focus();
  }

  // Dismiss on Escape from anywhere inside the shadow root.
  shadow.addEventListener('keydown', (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault();
      dismiss();
    }
  });

  // Also listen at the document level for Escape — keyboard events retargeted
  // through a closed shadow root bubble up as the host element to document
  // listeners, so this catches Escape even when focus is inside the shadow root.
  function docEscapeHandler(e: Event): void {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault();
      targetDocument.removeEventListener('keydown', docEscapeHandler, true);
      dismiss();
    }
  }
  targetDocument.addEventListener('keydown', docEscapeHandler, true);

  // Dismiss on click outside the panel (but inside the host).
  targetDocument.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !host.contains(e.target)) {
        targetDocument.removeEventListener('keydown', docEscapeHandler, true);
        dismiss();
      }
    },
    { once: true },
  );

  // Highlight-on-page: delegate click from highlight buttons inside shadow root.
  shadow.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest?.('[data-highlight-selector]');
    if (!btn) return;
    const selector = (btn as HTMLElement).dataset['highlightSelector'];
    if (!selector) return;
    highlightElement(targetDocument, selector);
  });

  return host;
}

/**
 * Show an error-state overlay (when the scan throws).
 */
export function showErrorOverlay(
  message: string,
  targetDocument: Document,
  returnFocusTo: Element | null = null,
): HTMLElement {
  removeOverlay(targetDocument);

  const host = targetDocument.createElement('div');
  host.id = OVERLAY_HOST_ID;
  host.setAttribute('data-ariada-overlay', '1');
  host.setAttribute('data-ariada-overlay-error', '1');

  const attachShadowFn = (host as unknown as Record<string, unknown>)['attachShadow'];
  if (typeof attachShadowFn !== 'function') {
    host.style.cssText =
      'position:fixed;top:1rem;right:1rem;z-index:2147483647;background:#2d0a0a;color:#fca5a5;border:2px solid #7f1d1d;border-radius:8px;padding:1rem;font-family:sans-serif;font-size:14px;';
    host.textContent = `Scan failed: ${message}`;
    targetDocument.body.appendChild(host);
    return host;
  }
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = targetDocument.createElement('style');
  style.textContent = OVERLAY_STYLES;

  const panel = targetDocument.createElement('div');
  panel.className = 'overlay';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ariada scan error');
  panel.setAttribute('aria-modal', 'false');

  const closeId = 'ariada-close-btn-err';
  panel.innerHTML = `
    <div class="overlay-header">
      <span class="overlay-title" style="color:#f87171">Ariada Scan</span>
      <button class="close-btn" id="${closeId}" aria-label="Close error panel" type="button">✕</button>
    </div>
    ${buildErrorContent(message)}
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  targetDocument.body.appendChild(host);

  const closeBtn = shadow.getElementById(closeId) as HTMLButtonElement | null;
  function dismiss(): void {
    removeOverlay(targetDocument);
    if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus();
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
    closeBtn.focus();
  }
  shadow.addEventListener('keydown', (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape') { e.preventDefault(); dismiss(); }
  });

  return host;
}

/**
 * Inject a loading-state overlay to show while the scan is in progress.
 * Callers should call `showOverlay()` or `showErrorOverlay()` when the scan
 * completes to replace this loading state.
 */
export function showLoadingOverlay(targetDocument: Document): HTMLElement {
  removeOverlay(targetDocument);

  const host = targetDocument.createElement('div');
  host.id = OVERLAY_HOST_ID;
  host.setAttribute('data-ariada-overlay', '1');
  host.setAttribute('data-ariada-overlay-loading', '1');

  const attachShadowFn = (host as unknown as Record<string, unknown>)['attachShadow'];
  if (typeof attachShadowFn !== 'function') {
    host.style.cssText =
      'position:fixed;top:1rem;right:1rem;z-index:2147483647;background:#1a1a2e;color:#e0e0e0;border:2px solid #4a9eff;border-radius:8px;padding:1rem;font-family:sans-serif;font-size:14px;';
    host.textContent = 'Scanning…';
    targetDocument.body.appendChild(host);
    return host;
  }
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = targetDocument.createElement('style');
  style.textContent = OVERLAY_STYLES;

  const panel = targetDocument.createElement('div');
  panel.className = 'overlay';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ariada scan in progress');
  panel.setAttribute('aria-modal', 'false');
  panel.innerHTML = `
    <div class="overlay-header">
      <span class="overlay-title">Ariada Scan</span>
    </div>
    ${buildLoadingContent()}
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  targetDocument.body.appendChild(host);

  return host;
}

/** ARIADA_HIGHLIGHT_ATTR is the attribute we add to temporarily highlighted elements. */
const ARIADA_HIGHLIGHT_ATTR = 'data-ariada-highlight';

/**
 * Inject a temporary visible outline on the element matching `selector` in
 * `targetDocument`. The outline is removed automatically after 3 seconds, or
 * when the user clicks anywhere.
 *
 * This addresses the most-praised feature of axe DevTools and WAVE: clicking
 * a finding scrolls to and highlights the failing element on the live page.
 */
export function highlightElement(targetDocument: Document, selector: string): void {
  // Remove any previous highlight.
  removeHighlight(targetDocument);

  let el: Element | null = null;
  try {
    el = targetDocument.querySelector(selector);
  } catch {
    // Invalid selector — silently ignore.
    return;
  }
  if (!(el instanceof HTMLElement)) return;

  el.setAttribute(ARIADA_HIGHLIGHT_ATTR, '1');
  const prevOutline = el.style.outline;
  const prevOutlineOffset = el.style.outlineOffset;
  const prevZIndex = el.style.zIndex;
  el.style.outline = '3px solid #ef4444';
  el.style.outlineOffset = '2px';
  el.style.zIndex = '2147483646';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  function restore(): void {
    if (el instanceof HTMLElement) {
      el.style.outline = prevOutline;
      el.style.outlineOffset = prevOutlineOffset;
      el.style.zIndex = prevZIndex;
      el.removeAttribute(ARIADA_HIGHLIGHT_ATTR);
    }
    targetDocument.removeEventListener('click', restore, true);
    clearTimeout(timer);
  }
  const timer = setTimeout(restore, 3000);
  targetDocument.addEventListener('click', restore, { once: true, capture: true });
}

/**
 * Remove any active element highlight added by `highlightElement`.
 */
export function removeHighlight(targetDocument: Document): void {
  const el = targetDocument.querySelector(`[${ARIADA_HIGHLIGHT_ATTR}]`);
  if (el instanceof HTMLElement) {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.zIndex = '';
    el.removeAttribute(ARIADA_HIGHLIGHT_ATTR);
  }
}

/**
 * Remove the overlay from the document if it exists.
 */
export function removeOverlay(targetDocument: Document): void {
  const existing = targetDocument.getElementById(OVERLAY_HOST_ID);
  if (existing) {
    existing.parentNode?.removeChild(existing);
  }
}
