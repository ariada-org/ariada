// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/confluence.js` and its declaration. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE RENDERED BODY IS ASKED FOR, NOT THE STORED ONE. What a reader meets is the
// rendered view; the stored form is markup the platform has not expanded yet, so
// scanning it would report on a document nobody sees.
//
// The size is checked twice, before and after reading. The declared length can
// be absent or wrong, so trusting it alone means trusting the other side about
// how much memory to use.
//
// And the page address is required to be secure. It ends up in the report as
// where this finding lives, and a report that points at an insecure address
// sends whoever reads it there.

import type { ForgeClaims, PageDescriptor } from '../shared/types.js';

export interface RenderedPage {
  descriptor: PageDescriptor;
  html: string;
}

interface ConfluencePage {
  title?: unknown;
  spaceId?: unknown;
  version?: { number?: number };
  body?: { view?: { value?: unknown } };
  _links?: { webui?: string };
}

const MAX_PAGE_BYTES = 5 * 1024 * 1024;

export async function fetchRenderedPage(
  claims: ForgeClaims,
  userToken: string,
  fetcher: typeof fetch = fetch,
): Promise<RenderedPage> {
  const contentId = claims.context.extension.content.id;
  const endpoint = `${claims.app.apiBaseUrl}/wiki/api/v2/pages/${encodeURIComponent(contentId)}?body-format=view`;
  const response = await fetcher(endpoint, {
    headers: { accept: 'application/json', authorization: `Bearer ${userToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Confluence page export failed with HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_PAGE_BYTES) throw new Error('Confluence page export exceeds 5 MiB');
  const page = (await response.json()) as ConfluencePage;
  const html = page.body?.view?.value;
  if (typeof html !== 'string' || html.length === 0 || Buffer.byteLength(html) > MAX_PAGE_BYTES) {
    throw new Error('Confluence did not return a usable body.view export');
  }
  const siteUrl = claims.context.siteUrl;
  const location = claims.context.extension.location;
  const webui = page._links?.webui;
  const url = webui && siteUrl ? new URL(webui, siteUrl).href : location;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Confluence context is missing a secure page URL');
  return {
    descriptor: {
      id: contentId,
      title: typeof page.title === 'string' && page.title.trim() ? page.title.trim() : 'Untitled Confluence page',
      url,
      ...(typeof page.spaceId === 'string' ? { spaceId: page.spaceId } : {}),
      ...(typeof page.version?.number === 'number' ? { version: page.version.number } : {}),
    },
    html,
  };
}
