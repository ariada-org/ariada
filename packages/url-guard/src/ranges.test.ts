// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import {
  ipv4InsideIpv6,
  ipv6Groups,
  isLoopbackName,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
} from './ranges.js';

describe('isPrivateIpv4', () => {
  it.each([
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['127.0.0.1', true],
    ['169.254.169.254', true], // cloud metadata
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['192.168.1.1', true],
    ['100.64.0.1', true],
    ['100.128.0.1', false],
    ['0.0.0.0', true],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['example.com', false],
  ])('classifies %s as private=%s', (host, expected) => {
    expect(isPrivateIpv4(host)).toBe(expected);
  });
});

describe('isLoopbackName', () => {
  it.each([
    ['localhost', true],
    ['LOCALHOST', true],
    ['localhost.localdomain', true],
    ['example.com', false],
  ])('classifies %s as loopback=%s', (host, expected) => {
    expect(isLoopbackName(host)).toBe(expected);
  });
});

describe('isPrivateIpv6', () => {
  it.each([
    ['::1', true],
    ['fe80::1', true],
    ['fc00::1', true],
    ['fd12:3456::1', true],
    ['2001:4860:4860::8888', false],
    // IPv4-mapped IPv6 pointing at private/loopback/metadata must be caught:
    ['::ffff:169.254.169.254', true],
    ['::ffff:127.0.0.1', true],
    ['[::ffff:127.0.0.1]', true],
    ['::ffff:a9fe:a9fe', true], // fully-hex form of 169.254.169.254
    // IPv4-mapped IPv6 pointing at a public address must NOT be caught:
    ['::ffff:8.8.8.8', false],
  ])('classifies %s as private=%s', (host, expected) => {
    expect(isPrivateIpv6(host)).toBe(expected);
  });
});

describe('the IPv4 address carried inside an IPv6 one', () => {
  it.each([
    ['::ffff:169.254.169.254', '169.254.169.254'],
    ['[::ffff:127.0.0.1]', '127.0.0.1'],
    ['::ffff:a9fe:a9fe', '169.254.169.254'],
    ['64:ff9b::a9fe:a9fe', '169.254.169.254'],
    ['2002:a9fe:a9fe::1', '169.254.169.254'],
    ['::1', null],
    ['2001:db8::1', null],
    ['example.com', null],
  ])('reads %s as %s', (host, expected) => {
    expect(ipv4InsideIpv6(host)).toBe(expected);
  });
});

describe('isPrivateAddress', () => {
  it.each([
    ['169.254.169.254', true],
    ['127.0.0.1', true],
    ['10.0.0.5', true],
    ['::1', true],
    ['::ffff:127.0.0.1', true],
    ['8.8.8.8', false],
    ['93.184.216.34', false],
  ])('classifies resolved %s as private=%s', (addr, expected) => {
    expect(isPrivateAddress(addr)).toBe(expected);
  });
});

describe('a domain name is not an address', () => {
  it('does not refuse hosts whose names begin like a private range', () => {
    // These were all refused: the unique-local test was reading a domain name
    // as an address, so every host starting fc or fd looked local.
    for (const host of ['fda.gov', 'fcc.gov', 'fdn.fr', 'fcbarcelona.com', 'fe80.example.com']) {
      expect(isPrivateIpv6(host)).toBe(false);
      expect(isPrivateAddress(host)).toBe(false);
    }
  });

  it('still refuses the ranges themselves', () => {
    for (const address of ['fc00::1', 'fd12:3456::1', 'fdff::', 'fe80::1', 'febf::1', '::1', '::']) {
      expect(isPrivateIpv6(address)).toBe(true);
    }
  });

  it('lets through addresses that only look like those ranges', () => {
    // fe00 and f000 are neither link-local nor unique-local, however similar
    // the first two characters are.
    for (const address of ['fe00::1', 'f000::1', '2001:db8::1']) {
      expect(isPrivateIpv6(address)).toBe(false);
    }
  });
});

describe('an address is the same address however it is written', () => {
  it('recognises loopback and unspecified in every spelling', () => {
    // Matching the text of `::1` answered questions about the text: the same
    // address written out in full came back as not private.
    for (const address of [
      '::1', '0:0:0:0:0:0:0:1', '0::1', '0000:0000:0000:0000:0000:0000:0000:0001',
      '::', '0:0:0:0:0:0:0:0', '0000::0',
    ]) {
      expect(isPrivateIpv6(address)).toBe(true);
    }
  });

  it('ignores a zone identifier, which names an interface and not an address', () => {
    for (const address of ['::1%lo0', 'fe80::1%en0', 'fd00::1%eth0']) {
      expect(isPrivateIpv6(address)).toBe(true);
    }
  });

  it('finds a private address wherever IPv6 can carry one', () => {
    // Every notation that puts an IPv4 address inside an IPv6 one. The
    // translation prefix is the one that matters: on a host with no IPv4, it
    // is how the configuration service is still reachable.
    for (const address of [
      '::ffff:169.254.169.254',   // mapped
      '::ffff:a9fe:a9fe',         // mapped, written in hex
      '::ffff:0:169.254.169.254', // translated
      '64:ff9b::169.254.169.254', // translation prefix
      '64:ff9b::a9fe:a9fe',
      '2002:a9fe:a9fe::1',        // tunnelling prefix
      '::169.254.169.254',        // compatible
    ]) {
      expect(isPrivateIpv6(address)).toBe(true);
    }
  });

  it('leaves alone the same notations carrying a public address', () => {
    for (const address of ['::ffff:93.184.216.34', '64:ff9b::93.184.216.34', '2002:5db8:d822::1']) {
      expect(isPrivateIpv6(address)).toBe(false);
    }
  });

  it('holds the edges of both ranges', () => {
    for (const inside of ['fe80::1', 'febf::1', 'fc00::1', 'fdff::1']) {
      expect(isPrivateIpv6(inside)).toBe(true);
    }
    for (const outside of ['fe7f::1', 'fec0::1', 'fbff::1', 'fe00::1', 'f000::1', '2001:db8::1']) {
      expect(isPrivateIpv6(outside)).toBe(false);
    }
  });
});

describe('a hostile hostname does not become the slow part', () => {
  it('handles a string of nothing but zone separators in constant time', () => {
    // The zone was cut with a pattern that had to back off and retry for every
    // `%`, so a host like this made the guard the expensive step.
    const hostile = `${'%'.repeat(50_000)}\n`;
    const started = Date.now();
    expect(isPrivateIpv6(hostile)).toBe(false);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it('still cuts a real zone identifier', () => {
    expect(isPrivateIpv6('fe80::1%en0')).toBe(true);
    expect(ipv6Groups('::1%lo0')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });
});
