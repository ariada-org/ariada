// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export interface StrapiEntryLike {
  [key: string]: unknown;
}

export interface StrapiUrlOptions {
  baseUrlByContentType: Record<string, string>;
  contentType: string;
  slugField?: string;
}

export interface StrapiScanRouteInput {
  entry: StrapiEntryLike;
  options: StrapiUrlOptions;
}

export function resolveStrapiEntryUrl(entry: StrapiEntryLike, options: StrapiUrlOptions): string {
  const baseUrl = options.baseUrlByContentType[options.contentType];
  const slugField = options.slugField ?? 'slug';
  const slug = entry[slugField];
  if (!baseUrl || typeof slug !== 'string' || slug.length === 0) {
    throw new Error(`Strapi ${options.contentType} entry is missing a configured rendered URL`);
  }
  return `${baseUrl.replace(/\/$/, '')}/${slug.replace(/^\//, '')}`;
}

export function createStrapiScanRoute(input: StrapiScanRouteInput): { body: { domains: string[]; source: string; url: string } } {
  return {
    body: {
      domains: ['accessibility'],
      source: `strapi.${input.options.contentType}`,
      url: resolveStrapiEntryUrl(input.entry, input.options),
    },
  };
}
