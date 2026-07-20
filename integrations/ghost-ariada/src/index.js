// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export function selectGhostPostUrl(payload) {
  const post = payload?.post?.current ?? payload?.post;
  const url = post?.url ?? post?.canonical_url;
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('Ghost webhook payload does not include a rendered post URL');
  }
  return url;
}

export function createScanRequest(url, options = {}) {
  return {
    domains: ['accessibility'],
    severityThreshold: options.severityThreshold ?? 'serious',
    source: 'ghost.post.published',
    url,
  };
}

export async function handleGhostPostPublished(payload, scanner, options = {}) {
  if (payload?.event !== 'post.published') {
    return { ok: true, skipped: true, reason: 'unsupported Ghost webhook event' };
  }
  const url = selectGhostPostUrl(payload);
  const request = createScanRequest(url, options);
  const report = await scanner(request);
  return { ok: true, report, request };
}
