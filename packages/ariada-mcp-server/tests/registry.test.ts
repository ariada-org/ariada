// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { AriadaMcpServer } from '../src/server.js';

describe('MCP registry packaging', () => {
  it('keeps package mcpName and server.json name aligned', async () => {
    const [pkgRaw, serverRaw] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
      readFile(new URL('../server.json', import.meta.url), 'utf8'),
    ]);
    const pkg = JSON.parse(pkgRaw) as { mcpName: string; version: string };
    const server = JSON.parse(serverRaw) as { name: string; version: string; packages: Array<{ identifier: string }> };
    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0]?.identifier).toBe('@ariada-org/mcp-server');
  });

  it('advertises registry name during initialize', () => {
    expect(new AriadaMcpServer().info.name).toBe('org.ariada/accessibility-scanner');
  });
});
