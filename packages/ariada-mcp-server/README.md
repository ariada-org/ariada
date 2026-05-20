<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# @ariada/mcp-server

Model Context Protocol (MCP) server that exposes the ariada open-source accessibility scanner as discoverable tools for AI coding assistants (Claude Code, Cursor, Continue, Zed).

## Install

```sh
npm install -g @ariada/mcp-server
```

## Quick start

Configure the server in your AI assistant. Example for Claude Desktop:

```jsonc
{
  "mcpServers": {
    "ariada": {
      "command": "npx",
      "args": ["@ariada/mcp-server", "--transport", "stdio"]
    }
  }
}
```

Example for Cursor (`.cursor/mcp.json`):

```jsonc
{
  "mcpServers": {
    "ariada": {
      "command": "npx",
      "args": ["@ariada/mcp-server"]
    }
  }
}
```

Once configured, the assistant can introspect and call four tools, list one prompt template, and read a resource catalogue.

## Tools

| Tool | Purpose |
|---|---|
| `ariada.scan` | Run a single-URL accessibility scan and return a structured report |
| `ariada.list-rules` | List the rule catalogue (filterable by pack, WCAG, or EN 301 549) |
| `ariada.explain-violation` | Return canonical explanatory text for a violation ID — never fabricates |
| `ariada.suggest-fix` | Return a remediation pattern; returns `no-known-pattern` when the corpus has no canonical fix |

## Programmatic use

```ts
import { AriadaMcpServer } from '@ariada/mcp-server';

const server = new AriadaMcpServer();
const tools = server.listTools();
const out = await server.callTool('ariada.list-rules', { pack: 'checkout' });
```

## Security

The server applies an SSRF guard before any scan: private-network addresses (RFC 1918, loopback, link-local), IPv6 ULA / link-local, and non-HTTP schemes (`file://`, `data://`, `javascript://`) are refused with structured JSON-RPC errors. Pass `--allow-private` only when scanning a known local development URL.

The server emits no telemetry and makes no network calls except to the scan target URL.

See `SECURITY.md` for reporting and supported-version policy.

## Transports

| Transport | Status | Notes |
|---|---|---|
| `stdio` | enabled by default | NDJSON-framed JSON-RPC 2.0 over stdin/stdout |
| `http` | scaffolded | Not enabled in this release |

## CLI

```sh
ariada-mcp-server --help
ariada-mcp-server --version
ariada-mcp-server --transport stdio
ariada-mcp-server --transport stdio --allow-private
```

## License

Source code is licensed under EUPL-1.2 (European Union Public Licence, version 1.2). See `LICENSE`. Per-file licensing is declared via SPDX headers and `REUSE.toml`.

## Maintainer

Maintained by Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726).
