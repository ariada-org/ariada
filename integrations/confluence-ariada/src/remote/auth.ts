// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/auth.js` and `dist/remote/auth.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// the rebuild check.
//
// FIVE THINGS ARE CHECKED, AND A VALID SIGNATURE IS ONLY THE FIRST. Anybody can
// hold a correctly signed token from some other app; what makes this request
// ours is that the audience, the issuer, the application identifier, the API
// host and the extension point all agree.
//
// The API host is checked because the token names the address this service would
// then call back with the user's token. A token that verifies but points
// somewhere else is a request to hand a user's credentials to that somewhere.
//
// The content identifier is checked as digits because it goes into a URL. And
// the extension type is checked because a token minted for one part of an app is
// not authority for another.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import type { ForgeClaims } from '../shared/types.js';

const ATLASSIAN_JWKS = new URL('https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json');
const jwks = createRemoteJWKSet(ATLASSIAN_JWKS);

function appAri(value: string): string {
  return value.startsWith('ari:cloud:ecosystem::app/') ? value : `ari:cloud:ecosystem::app/${value}`;
}

function claims(payload: JWTPayload): ForgeClaims {
  const app = payload['app'];
  const context = payload['context'];
  if (!app || typeof app !== 'object' || !context || typeof context !== 'object') {
    throw new Error('FIT is missing app or context claims');
  }
  return payload as unknown as ForgeClaims;
}

export async function verifyForgeInvocation(token: string, expectedAppId: string): Promise<ForgeClaims> {
  const expected = appAri(expectedAppId);
  const verified = await jwtVerify(token, jwks, {
    audience: expected,
    issuer: 'forge/invocation-token',
  });
  const parsed = claims(verified.payload);
  if (parsed.app.id !== expected) throw new Error('FIT app ID does not match this service');
  const apiBaseUrl = new URL(parsed.app.apiBaseUrl);
  if (apiBaseUrl.protocol !== 'https:' || apiBaseUrl.hostname !== 'api.atlassian.com') {
    throw new Error('FIT apiBaseUrl is not the Atlassian Commercial Cloud API');
  }
  if (parsed.context.extension.type !== 'confluence:contentAction') {
    throw new Error('FIT did not originate from the Confluence content action');
  }
  if (!/^\d+$/.test(parsed.context.extension.content.id)) {
    throw new Error('FIT contains an invalid Confluence content ID');
  }
  return parsed;
}
