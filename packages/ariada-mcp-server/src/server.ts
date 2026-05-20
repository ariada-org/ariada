// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { McpServerError } from './errors.js';
import {
  explainViolationInputSchema,
  runExplainViolation,
  type ExplanationResult,
} from './tools/explain-violation.js';
import { listRulesInputSchema, runListRules, type RuleSummary } from './tools/list-rules.js';
import { runScan, scanInputSchema, type RunScanOptions, type ScanResult } from './tools/scan.js';
import { runSuggestFix, suggestFixInputSchema, type SuggestFixResult } from './tools/suggest-fix.js';

/**
 * Server metadata advertised on the MCP `initialize` handshake.
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * Construction options for the server.
 */
export interface ServerOptions {
  info?: ServerInfo;
  allowPrivate?: boolean;
  /**
   * Caller-injected scan implementation. When omitted, `ariada.scan` returns
   * an empty `ScanResult` — this keeps the library importable without the
   * heavy Playwright dependency tree.
   */
  scan?: RunScanOptions['scan'];
}

/**
 * Definition of one MCP tool exposed by the server.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const DEFAULT_INFO: ServerInfo = { name: 'ariada-mcp-server', version: '0.1.0' };

async function defaultScan(parsed: URL): Promise<ScanResult> {
  const now = new Date().toISOString();
  return {
    scanId: `local-${Date.now().toString(36)}`,
    url: parsed.href,
    startedAt: now,
    finishedAt: now,
    summary: { total: 0, bySeverity: { minor: 0, moderate: 0, serious: 0, critical: 0 } },
    findings: [],
  };
}

/**
 * In-process orchestrator that dispatches MCP tool calls to the library
 * handlers. This is the layer the transport (stdio / HTTP) wraps.
 *
 * Tests instantiate `AriadaMcpServer` directly to exercise the tool layer
 * without spinning a real transport.
 */
export class AriadaMcpServer {
  public readonly info: ServerInfo;
  private readonly allowPrivate: boolean;
  private readonly scan: RunScanOptions['scan'];

  /**
   * Construct a server. All options are optional; defaults give a server that
   * advertises `name: ariada-mcp-server` and runs `ariada.scan` against a stub
   * implementation returning an empty `ScanResult`.
   *
   * @param options - Server construction options.
   */
  constructor(options: ServerOptions = {}) {
    this.info = options.info ?? DEFAULT_INFO;
    this.allowPrivate = options.allowPrivate === true;
    this.scan = options.scan ?? defaultScan;
  }

  /**
   * Return the static set of tool definitions advertised on `tools/list`.
   */
  listTools(): ToolDefinition[] {
    return [
      {
        name: 'ariada.scan',
        description:
          'Run a single-URL accessibility scan using the ariada OSS pipeline. Returns a structured UnifiedReport.',
        inputSchema: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            locale: { type: 'string', enum: ['en', 'sv', 'nb', 'da', 'fi'] },
            jurisdiction: {
              type: 'string',
              enum: ['SE', 'DE', 'FR', 'DK', 'FI', 'NO', 'IS', 'EU', 'UK', 'IT', 'ES'],
            },
            pack: { type: 'string', enum: ['checkout', 'banking', 'statement', 'all'] },
            rules: { type: 'array', items: { type: 'string' } },
            severityThreshold: {
              type: 'string',
              enum: ['minor', 'moderate', 'serious', 'critical'],
            },
            browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
            timeoutMs: { type: 'integer', minimum: 1000, maximum: 120000 },
          },
        },
      },
      {
        name: 'ariada.list-rules',
        description: 'List the rule catalogue. Pure lookup — no network and no LLM inference.',
        inputSchema: {
          type: 'object',
          properties: {
            pack: { type: 'string', enum: ['checkout', 'banking', 'statement', 'all'] },
            wcagOnly: { type: 'boolean' },
            en301549Only: { type: 'boolean' },
          },
        },
      },
      {
        name: 'ariada.explain-violation',
        description:
          'Return canonical explanatory text for a violation ID. Never fabricates — unknown IDs return status: unknown-violation.',
        inputSchema: {
          type: 'object',
          required: ['violationId'],
          properties: {
            violationId: { type: 'string' },
            locale: { type: 'string', enum: ['en', 'sv', 'nb', 'da', 'fi'] },
            depth: { type: 'string', enum: ['short', 'long'] },
          },
        },
      },
      {
        name: 'ariada.suggest-fix',
        description:
          'Return a remediation pattern for a violation. When no canonical pattern is registered, returns confidence: no-known-pattern with a hint to consult a specialist.',
        inputSchema: {
          type: 'object',
          required: ['violationId'],
          properties: {
            violationId: { type: 'string' },
            context: {
              type: 'object',
              properties: {
                framework: {
                  type: 'string',
                  enum: ['html', 'react', 'vue', 'angular', 'svelte', 'solid'],
                },
                snippet: { type: 'string' },
              },
            },
            locale: { type: 'string', enum: ['en', 'sv', 'nb', 'da', 'fi'] },
          },
        },
      },
    ];
  }

  /**
   * Dispatch a tool call by name. Validates the input with Zod, runs the
   * handler, and wraps any error as `McpServerError`.
   */
  async callTool(
    name: string,
    rawInput: unknown,
  ): Promise<RuleSummary[] | ExplanationResult | SuggestFixResult | ScanResult> {
    switch (name) {
      case 'ariada.list-rules': {
        const parsed = listRulesInputSchema.safeParse(rawInput ?? {});
        if (!parsed.success) {
          throw new McpServerError('InvalidParams', 'list-rules input invalid', {
            issues: parsed.error.issues,
          });
        }
        return runListRules(parsed.data);
      }
      case 'ariada.explain-violation': {
        const parsed = explainViolationInputSchema.safeParse(rawInput ?? {});
        if (!parsed.success) {
          throw new McpServerError('InvalidParams', 'explain-violation input invalid', {
            issues: parsed.error.issues,
          });
        }
        return runExplainViolation(parsed.data);
      }
      case 'ariada.suggest-fix': {
        const parsed = suggestFixInputSchema.safeParse(rawInput ?? {});
        if (!parsed.success) {
          throw new McpServerError('InvalidParams', 'suggest-fix input invalid', {
            issues: parsed.error.issues,
          });
        }
        return runSuggestFix(parsed.data);
      }
      case 'ariada.scan': {
        const parsed = scanInputSchema.safeParse(rawInput ?? {});
        if (!parsed.success) {
          throw new McpServerError('InvalidParams', 'scan input invalid', {
            issues: parsed.error.issues,
          });
        }
        return await runScan(parsed.data, {
          allowPrivate: this.allowPrivate,
          scan: this.scan,
        });
      }
      default:
        throw new McpServerError('MethodNotFound', `Tool not found: ${name}`, { name });
    }
  }

  /**
   * Resource catalogue exposed via `resources/list`.
   */
  listResources(): Array<{ uri: string; name: string; mimeType: string }> {
    return [
      {
        uri: 'rules://catalogue',
        name: 'Full rule catalogue',
        mimeType: 'application/json',
      },
      {
        uri: 'rules://catalogue/checkout',
        name: 'Checkout pack rule catalogue',
        mimeType: 'application/json',
      },
      {
        uri: 'rules://catalogue/banking',
        name: 'Banking pack rule catalogue',
        mimeType: 'application/json',
      },
      {
        uri: 'rules://catalogue/statement',
        name: 'Statement pack rule catalogue',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Read a resource by URI. Returns the resource payload as a JSON string.
   */
  readResource(uri: string): { uri: string; mimeType: string; text: string } {
    if (uri === 'rules://catalogue') {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(runListRules({}), null, 2),
      };
    }
    const prefix = 'rules://catalogue/';
    if (uri.startsWith(prefix)) {
      const pack = uri.slice(prefix.length);
      if (pack === 'checkout' || pack === 'banking' || pack === 'statement') {
        return {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(runListRules({ pack }), null, 2),
        };
      }
    }
    throw new McpServerError('InvalidParams', `Unknown resource URI: ${uri}`, { uri });
  }

  /**
   * Prompt catalogue.
   */
  listPrompts(): Array<{ name: string; description: string }> {
    return [
      {
        name: 'fix-violation-prompt',
        description:
          'Template for asking the user LLM to adapt a remediation pattern returned by ariada.suggest-fix to the user codebase.',
      },
    ];
  }
}
