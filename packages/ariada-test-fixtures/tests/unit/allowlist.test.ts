// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Allowlist regression tests per PRD §6.1 (`tests/unit/allowlist.test.ts`).
// Each ALLOWED entry returns 200 + `text/html; charset=utf-8`. Unknown
// paths return 404. Path-traversal attempts return 404 (allowlist defeats
// `..` traversal — PRD §5.3 invariant).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startFixtureServer, type FixtureServer } from '../../src/serve.ts';

const ALLOWED_FIXTURES = [
  'basic-pass.html',
  'color-contrast.html',
  'alt-text.html',
  'shadow-dom.html',
  'iframe-nested.html',
  'iframe-child.html',
  'mixed-severity.html',
] as const;

let fx: FixtureServer;

beforeAll(async () => {
  fx = await startFixtureServer();
});

afterAll(async () => {
  await fx.stop();
});

describe('fixture-server allowlist', () => {
  for (const name of ALLOWED_FIXTURES) {
    it(`GET /${name} returns 200 + text/html`, async () => {
      const res = await fetch(`${fx.url}/${name}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe(
        'text/html; charset=utf-8',
      );
      expect(res.headers.get('cache-control')).toBe('no-store');
      const body = await res.text();
      expect(body.length).toBeGreaterThan(0);
    });
  }

  it('GET / serves `basic-pass.html` as the default route', async () => {
    const res = await fetch(`${fx.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('GET /unknown.html returns 404', async () => {
    const res = await fetch(`${fx.url}/unknown.html`);
    expect(res.status).toBe(404);
  });

  it('GET /../package.json (path-traversal attempt) returns 404', async () => {
    // Use the raw network path to avoid `fetch` URL normalisation.
    const url = new URL(fx.url);
    const path = '/../package.json';
    const res = await fetch(`http://${url.host}${path}`);
    expect(res.status).toBe(404);
  });

  it('GET /eu-real-world/klarna-style-cart-sv.html returns 404 (out of allowlist)', async () => {
    // EU real-world fixtures are deliberately NOT in the server allowlist.
    // They are consumed via direct file import, not over HTTP. The narrow
    // server allowlist enforces the loopback-only invariant + path safety.
    const res = await fetch(`${fx.url}/eu-real-world/klarna-style-cart-sv.html`);
    expect(res.status).toBe(404);
  });

  it('GET /basic-pass.html?qs=ignored honours the query-string strip', async () => {
    const res = await fetch(`${fx.url}/basic-pass.html?ignored=true`);
    expect(res.status).toBe(200);
  });
});
