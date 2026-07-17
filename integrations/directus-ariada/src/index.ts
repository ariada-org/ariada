// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export interface DirectusItemLike {
  [key: string]: unknown;
}

export interface DirectusCollectionConfig {
  baseUrl: string;
  slugField?: string;
}

export function resolveDirectusItemUrl(item: DirectusItemLike, config: DirectusCollectionConfig): string {
  const slug = item[config.slugField ?? 'slug'];
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('Directus item is missing the configured slug field');
  }
  return `${config.baseUrl.replace(/\/$/, '')}/${slug.replace(/^\//, '')}`;
}

export function createDirectusPanelState(item: DirectusItemLike, config: DirectusCollectionConfig): { request: { domains: string[]; source: string; url: string } } {
  return {
    request: {
      domains: ['accessibility'],
      source: 'directus.item-panel',
      url: resolveDirectusItemUrl(item, config),
    },
  };
}
