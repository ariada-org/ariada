// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  registeredDomain,
  isSameRegisteredDomain,
  partitionByRegisteredDomain,
} from './first-party.js';

describe('registeredDomain', () => {
  it('returns the TLD+1 for a simple https URL', () => {
    expect(registeredDomain('https://www.example.com/path?q=1')).toBe('example.com');
  });

  it('returns the TLD+1 for a subdomain URL', () => {
    expect(registeredDomain('https://sub.brand.example.com/')).toBe('example.com');
  });

  it('returns null for a non-http/https URL', () => {
    expect(registeredDomain('chrome-extension://abc/sidepanel.html')).toBeNull();
    expect(registeredDomain('file:///home/user/test.html')).toBeNull();
  });

  it('returns null for an unparseable string', () => {
    expect(registeredDomain('not a url')).toBeNull();
  });

  it('handles a bare hostname with no subdomain', () => {
    expect(registeredDomain('https://example.com')).toBe('example.com');
  });
});

describe('isSameRegisteredDomain', () => {
  it('returns true for two URLs on the same registered domain', () => {
    expect(isSameRegisteredDomain('https://www.example.com/', 'https://shop.example.com/')).toBe(true);
  });

  it('returns false for URLs on different registered domains', () => {
    expect(isSameRegisteredDomain('https://example.com/', 'https://other.com/')).toBe(false);
  });

  it('returns false when either URL is non-http', () => {
    expect(isSameRegisteredDomain('chrome://extensions', 'https://example.com/')).toBe(false);
  });
});

describe('partitionByRegisteredDomain', () => {
  it('puts same-domain URLs in firstParty and others in thirdParty', () => {
    const anchor = 'https://www.acme.com/';
    const result = partitionByRegisteredDomain(anchor, [
      'https://shop.acme.com/',
      'https://competitor.com/',
      'https://acme.com/about',
    ]);
    expect(result.firstParty).toEqual(['https://shop.acme.com/', 'https://acme.com/about']);
    expect(result.thirdParty).toEqual(['https://competitor.com/']);
  });

  it('returns empty arrays when the candidates list is empty', () => {
    const result = partitionByRegisteredDomain('https://example.com/', []);
    expect(result.firstParty).toEqual([]);
    expect(result.thirdParty).toEqual([]);
  });
});
