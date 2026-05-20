// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { ERROR_CODES, McpServerError } from '../errors.js';
import type { AriadaMcpServer } from '../server.js';

/**
 * Minimal JSON-RPC 2.0 envelope shared by request, response, and notification.
 */
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Inputs for `handleStdioMessage` — exported so tests can drive the
 * dispatcher directly without spawning a child process.
 */
export interface DispatchContext {
  server: AriadaMcpServer;
}

function makeResponse(id: JsonRpcMessage['id'] | null, result: unknown): JsonRpcMessage {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function errorFrame(
  id: JsonRpcMessage['id'] | null,
  code: number,
  message: string,
): JsonRpcMessage {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function initializeResult(server: AriadaMcpServer): unknown {
  return {
    serverInfo: server.info,
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
      logging: {},
    },
    protocolVersion: '2025-06-18',
  };
}

async function handleToolsCall(
  server: AriadaMcpServer,
  params: unknown,
): Promise<unknown> {
  const p = (params as { name?: string; arguments?: unknown }) ?? {};
  const name = typeof p.name === 'string' ? p.name : '';
  if (!name) {
    throw new McpServerError('InvalidParams', 'tools/call requires name');
  }
  const out = await server.callTool(name, p.arguments);
  return {
    content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
    structuredContent: out as unknown,
  };
}

function handleResourcesRead(server: AriadaMcpServer, params: unknown): unknown {
  const p = (params as { uri?: string }) ?? {};
  const uri = typeof p.uri === 'string' ? p.uri : '';
  if (!uri) {
    throw new McpServerError('InvalidParams', 'resources/read requires uri');
  }
  return { contents: [server.readResource(uri)] };
}

type Route = (server: AriadaMcpServer, params: unknown) => Promise<unknown> | unknown;

const ROUTES: Record<string, Route | 'notification-only'> = {
  initialize: (server) => initializeResult(server),
  initialized: 'notification-only',
  ping: () => ({}),
  'tools/list': (server) => ({ tools: server.listTools() }),
  'tools/call': handleToolsCall,
  'resources/list': (server) => ({ resources: server.listResources() }),
  'resources/read': handleResourcesRead,
  'prompts/list': (server) => ({ prompts: server.listPrompts() }),
};

function parseFrame(raw: string): { ok: true; frame: JsonRpcMessage } | { ok: false; frame: JsonRpcMessage } {
  try {
    const frame = JSON.parse(raw) as JsonRpcMessage;
    return { ok: true, frame };
  } catch {
    return { ok: false, frame: { jsonrpc: '2.0' } };
  }
}

function errorFromException(reqId: JsonRpcMessage['id'] | null, err: unknown): JsonRpcMessage {
  if (err instanceof McpServerError) {
    return {
      jsonrpc: '2.0',
      id: reqId ?? null,
      error: { code: err.code, message: err.message, data: err.data },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return errorFrame(reqId ?? null, ERROR_CODES.InternalError, message);
}

/**
 * Decode a JSON-RPC frame, dispatch to the appropriate handler, and return
 * the JSON-RPC response frame (or `null` for notifications and methods that
 * MCP defines as fire-and-forget).
 */
export async function handleStdioMessage(
  ctx: DispatchContext,
  raw: string,
): Promise<JsonRpcMessage | null> {
  const parseResult = parseFrame(raw);
  if (!parseResult.ok) {
    return errorFrame(null, ERROR_CODES.ParseError, 'Frame did not parse as JSON');
  }
  const parsed = parseResult.frame;
  if (parsed.jsonrpc !== '2.0' || typeof parsed.method !== 'string') {
    if (parsed.id !== undefined) {
      return errorFrame(parsed.id ?? null, ERROR_CODES.InvalidRequest, 'Not a JSON-RPC 2.0 frame');
    }
    return null;
  }

  const isNotification = parsed.id === undefined;
  const reqId = parsed.id ?? null;
  const route = ROUTES[parsed.method];

  if (route === undefined) {
    if (isNotification) return null;
    return errorFrame(reqId, ERROR_CODES.MethodNotFound, `Unknown method: ${parsed.method}`);
  }
  if (route === 'notification-only') {
    return null;
  }

  try {
    const result = await route(ctx.server, parsed.params);
    return isNotification ? null : makeResponse(reqId, result);
  } catch (err) {
    if (isNotification) return null;
    return errorFromException(reqId, err);
  }
}

/**
 * Glue the dispatcher onto a pair of streams. Lines on `input` are parsed as
 * JSON-RPC frames; response frames are written to `output` as NDJSON.
 *
 * Returns a promise that resolves when `input` ends (EOF).
 */
export function attachStdioTransport(
  ctx: DispatchContext,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  return new Promise((resolve) => {
    let buffer = '';
    input.setEncoding?.('utf8');
    input.on('data', (chunk: string | Buffer) => {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line.length > 0) {
          void handleStdioMessage(ctx, line).then((resp) => {
            if (resp) {
              output.write(`${JSON.stringify(resp)}\n`);
            }
            return undefined;
          });
        }
        nl = buffer.indexOf('\n');
      }
    });
    input.on('end', () => resolve());
    input.on('close', () => resolve());
  });
}
