// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export interface SanityDocumentLike {
  previewUrl?: unknown;
  slug?: { current?: unknown };
}

export interface SanityPreviewOptions {
  baseUrl?: string;
}

export interface SanityScanPanel {
  findingCount: number;
  request: { domains: string[]; source: string; url: string };
}

export function resolveSanityPreviewUrl(document: SanityDocumentLike, options: SanityPreviewOptions = {}): string {
  if (typeof document.previewUrl === 'string' && document.previewUrl.startsWith('http')) return document.previewUrl;
  if (typeof document.slug?.current === 'string' && options.baseUrl) {
    return `${options.baseUrl.replace(/\/$/, '')}/${document.slug.current.replace(/^\//, '')}`;
  }
  throw new Error('Sanity document is missing a rendered preview URL');
}

export function createSanityScanPanel(document: SanityDocumentLike, options: SanityPreviewOptions = {}): SanityScanPanel {
  const url = resolveSanityPreviewUrl(document, options);
  return { findingCount: 0, request: { domains: ['accessibility'], source: 'sanity.document-preview', url } };
}

export function countSanityFindings(report: unknown): number {
  if (!report || typeof report !== 'object') return 0;
  const findings = (report as { findings?: unknown }).findings;
  return Array.isArray(findings) ? findings.length : 0;
}
