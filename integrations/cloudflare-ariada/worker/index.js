// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* global Response, fetch */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const { url, failOnSeverity = 'serious' } = await request.json();
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      return Response.json({ error: 'url must be an https URL' }, { status: 400 });
    }

    const response = await fetch(`${env.ARIADA_API_BASE_URL}/v1/scans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.ARIADA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, failOnSeverity }),
    });

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    });
  },
};
