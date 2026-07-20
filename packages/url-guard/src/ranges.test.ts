// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import {
  ipv4FromMappedIpv6,
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

describe('ipv4FromMappedIpv6', () => {
  it.each([
    ['::ffff:169.254.169.254', '169.254.169.254'],
    ['[::ffff:127.0.0.1]', '127.0.0.1'],
    ['::ffff:a9fe:a9fe', '169.254.169.254'],
    ['::1', null],
    ['2001:db8::1', null],
    ['example.com', null],
  ])('maps %s to %s', (host, expected) => {
    expect(ipv4FromMappedIpv6(host)).toBe(expected);
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
