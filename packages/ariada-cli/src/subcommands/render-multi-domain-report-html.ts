// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * The multi-domain report renderer now lives in `@ariada-org/scan-report-html`
 * — the single rendering home shared by the CLI, the GitHub Action, and any
 * future surface (no divergent per-surface renderers). This module re-exports
 * it under the CLI's existing name so callers are unchanged.
 */
export { renderMultiDomainReport as renderMultiDomainReportHtml } from '@ariada-org/scan-report-html';
