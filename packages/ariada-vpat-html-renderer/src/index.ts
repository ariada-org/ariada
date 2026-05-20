// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Public API surface. The renderer is a single pure function exported here,
// alongside the input + option types it consumes. No side-effects at import
// time; no logging; no telemetry.

export { renderVpatHtml } from './render-vpat-html.js';
export type {
  RenderOptions,
  BrandOptions,
  VpatReport,
  VpatCriterion,
  VpatConformanceLevel,
  VpatConformanceStatus,
  VpatMeta,
  VpatSummary,
} from './types.js';
