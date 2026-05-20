// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '../src/errors.js';
import { AriadaMcpServer } from '../src/server.js';
import { handleStdioMessage } from '../src/transports/stdio.js';

function ctx() {
  return { server: new AriadaMcpServer() };
}

describe('handleStdioMessage', () => {
  it('responds to initialize with serverInfo + protocol version', async () => {
    const out = await handleStdioMessage(ctx(), JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }));
    expect(out).not.toBeNull();
    expect(out?.result).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'ariada-mcp-server' },
    });
  });

  it('treats initialized as a notification (no response)', async () => {
    const out = await handleStdioMessage(ctx(), JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }));
    expect(out).toBeNull();
  });

  it('responds to ping with empty result', async () => {
    const out = await handleStdioMessage(ctx(), JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }));
    expect(out?.result).toEqual({});
  });

  it('responds to tools/list with exactly four tools', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
    );
    const result = out?.result as { tools: Array<{ name: string }> };
    expect(result.tools.length).toBe(4);
  });

  it('responds to tools/call ariada.list-rules with structured content', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'ariada.list-rules', arguments: {} },
      }),
    );
    const result = out?.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0]?.type).toBe('text');
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as unknown;
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('returns ParseError for malformed JSON frames', async () => {
    const out = await handleStdioMessage(ctx(), 'this is not json');
    expect(out?.error?.code).toBe(ERROR_CODES.ParseError);
  });

  it('returns MethodNotFound for an unknown method', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'unknown/method' }),
    );
    expect(out?.error?.code).toBe(ERROR_CODES.MethodNotFound);
  });

  it('returns InvalidRequest for non-JSON-RPC envelopes', async () => {
    const out = await handleStdioMessage(ctx(), JSON.stringify({ id: 6, foo: 'bar' }));
    expect(out?.error?.code).toBe(ERROR_CODES.InvalidRequest);
  });

  it('lists resources via resources/list', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'resources/list' }),
    );
    const result = out?.result as { resources: Array<{ uri: string }> };
    expect(result.resources.length).toBeGreaterThan(0);
  });

  it('reads rules://catalogue via resources/read', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'resources/read',
        params: { uri: 'rules://catalogue' },
      }),
    );
    const result = out?.result as { contents: Array<{ uri: string; text: string }> };
    expect(result.contents[0]?.uri).toBe('rules://catalogue');
  });

  it('lists prompts via prompts/list', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'prompts/list' }),
    );
    const result = out?.result as { prompts: Array<{ name: string }> };
    expect(result.prompts[0]?.name).toBe('fix-violation-prompt');
  });

  it('surfaces SsrfRefused for a private URL via tools/call ariada.scan', async () => {
    const out = await handleStdioMessage(
      ctx(),
      JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: { name: 'ariada.scan', arguments: { url: 'http://10.0.0.1/' } },
      }),
    );
    expect(out?.error?.code).toBe(ERROR_CODES.SsrfRefused);
  });
});
