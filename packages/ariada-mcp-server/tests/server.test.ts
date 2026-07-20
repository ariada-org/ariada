// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { ERROR_CODES, McpServerError } from '../src/errors.js';
import { AriadaMcpServer } from '../src/server.js';

describe('AriadaMcpServer', () => {
  it('lists exactly four tools', () => {
    const server = new AriadaMcpServer();
    const tools = server.listTools();
    expect(tools.length).toBe(4);
    const names = tools.map((t) => t.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(names).toEqual([
      'ariada.explain-violation',
      'ariada.list-rules',
      'ariada.scan',
      'ariada.suggest-fix',
    ]);
  });

  it('lists at least one prompt', () => {
    const server = new AriadaMcpServer();
    const prompts = server.listPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]?.name).toBe('fix-violation-prompt');
  });

  it('lists resources including the catalogue', () => {
    const server = new AriadaMcpServer();
    const resources = server.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('rules://catalogue');
  });

  it('reads the rules://catalogue resource as JSON', () => {
    const server = new AriadaMcpServer();
    const out = server.readResource('rules://catalogue');
    expect(out.mimeType).toBe('application/json');
    const parsed = JSON.parse(out.text) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('rejects unknown resource URIs with InvalidParams', () => {
    const server = new AriadaMcpServer();
    try {
      server.readResource('rules://catalogue/unknown-pack');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.InvalidParams);
    }
  });

  it('callTool routes ariada.list-rules and returns rule summaries', async () => {
    const server = new AriadaMcpServer();
    const out = await server.callTool('ariada.list-rules', {});
    expect(Array.isArray(out)).toBe(true);
  });

  it('callTool returns MethodNotFound for unknown tool', async () => {
    const server = new AriadaMcpServer();
    try {
      await server.callTool('ariada.nonexistent', {});
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.MethodNotFound);
    }
  });

  it('callTool returns InvalidParams for ariada.scan with malformed input', async () => {
    const server = new AriadaMcpServer();
    try {
      await server.callTool('ariada.scan', { url: 123 });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.InvalidParams);
    }
  });

  it('callTool runs ariada.scan with an injected scan implementation', async () => {
    const server = new AriadaMcpServer({
      scan: async () => ({
        scanId: 'fixture',
        url: 'https://example.com/',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:00:01.000Z',
        summary: { total: 0, bySeverity: { minor: 0, moderate: 0, serious: 0, critical: 0 } },
        findings: [],
      }),
    });
    const out = await server.callTool('ariada.scan', { url: 'https://example.com/' });
    expect(out).toMatchObject({ scanId: 'fixture' });
  });

  it('callTool ariada.scan refuses SSRF without allow-private', async () => {
    const server = new AriadaMcpServer();
    try {
      await server.callTool('ariada.scan', { url: 'http://10.0.0.1/admin' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it('advertises a serverInfo name + version', () => {
    const server = new AriadaMcpServer();
    expect(server.info.name).toBe('org.ariada/accessibility-scanner');
    expect(server.info.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
