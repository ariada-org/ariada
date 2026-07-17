// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export interface PayloadDocumentLike {
  [key: string]: unknown;
}

export interface PayloadPreviewOptions {
  baseUrl?: string;
  previewUrlField?: string;
  slugField?: string;
}

export interface PayloadPluginConfig {
  collection: string;
  preview: PayloadPreviewOptions;
}

export function resolvePayloadPreviewUrl(document: PayloadDocumentLike, options: PayloadPreviewOptions = {}): string {
  const direct = document[options.previewUrlField ?? 'previewUrl'];
  if (typeof direct === 'string' && direct.startsWith('http')) return direct;
  const slug = document[options.slugField ?? 'slug'];
  if (typeof slug === 'string' && options.baseUrl) return `${options.baseUrl.replace(/\/$/, '')}/${slug.replace(/^\//, '')}`;
  throw new Error('Payload document is missing a rendered preview URL');
}

export function createPayloadPluginConfig(collection: string, preview: PayloadPreviewOptions): PayloadPluginConfig {
  return { collection, preview };
}

export function createPayloadScanRequest(document: PayloadDocumentLike, config: PayloadPluginConfig): { domains: string[]; source: string; url: string } {
  return {
    domains: ['accessibility'],
    source: `payload.${config.collection}`,
    url: resolvePayloadPreviewUrl(document, config.preview),
  };
}
