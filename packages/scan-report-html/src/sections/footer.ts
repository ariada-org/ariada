// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Methodology + identity footer.
 *
 * Renders the methodology metadata block + bit-exact identity footer line
 * + an optional cert-block hookpoint comment that downstream tooling can
 * inject extensions into when `options.releaseBuild` is false.
 */

import { escapeHtml } from '../escape.js';
import type { ScanMeta } from '../types.js';

/**
 *
 */
export interface FooterOptions {
  releaseBuild: boolean;
}

/**
 * Identity footer — bit-exact, asserted by tests.
 */
export const IDENTITY_FOOTER_TEXT =
  'Maintained by Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726). License: EUPL-1.2.';

/**
 * Render the methodology + identity footer block.
 */
export function renderFooter(meta: ScanMeta, options: FooterOptions): string {
  const certBlock = options.releaseBuild
    ? '<div data-cert-block></div>'
    : '<!-- cert-block hookpoint --> <div data-cert-block></div>';

  const wcag = meta.wcagVersion ?? '2.2';
  const en301549 = meta.en301549Version ?? '3.2.1';
  const axe = meta.axeVersion ?? 'n/a';
  const ua = meta.userAgent ?? 'n/a';
  const viewport = meta.viewport ?? 'n/a';

  return `<footer class="report-footer" role="contentinfo">
  ${certBlock}
  <h2 class="report-footer__heading">Methodology</h2>
  <dl class="report-footer__meta">
    <div class="report-footer__row">
      <dt>Scanner</dt>
      <dd>ariada v${escapeHtml(meta.scannerVersion)}</dd>
    </div>
    <div class="report-footer__row">
      <dt>axe-core</dt>
      <dd>${escapeHtml(axe)}</dd>
    </div>
    <div class="report-footer__row">
      <dt>WCAG</dt>
      <dd>${escapeHtml(wcag)} Level AA</dd>
    </div>
    <div class="report-footer__row">
      <dt>EN 301 549</dt>
      <dd>v${escapeHtml(en301549)}</dd>
    </div>
    <div class="report-footer__row">
      <dt>Browser</dt>
      <dd>${escapeHtml(ua)}</dd>
    </div>
    <div class="report-footer__row">
      <dt>Viewport</dt>
      <dd>${escapeHtml(viewport)}</dd>
    </div>
  </dl>
  <p class="report-footer__identity">${escapeHtml(IDENTITY_FOOTER_TEXT)}</p>
</footer>`;
}
