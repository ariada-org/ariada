#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { AriadaMcpServer } from './server.js';
import { attachStdioTransport } from './transports/stdio.js';

interface Cli {
  transport: 'stdio' | 'http';
  allowPrivate: boolean;
}

function parseArgs(argv: string[]): Cli {
  const out: Cli = { transport: 'stdio', allowPrivate: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--transport' && typeof argv[i + 1] === 'string') {
      const value = argv[i + 1] as string;
      if (value === 'stdio' || value === 'http') {
        out.transport = value;
      }
      i += 1;
    } else if (a === '--allow-private') {
      out.allowPrivate = true;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a === '--version' || a === '-V') {
      // Static version — matches package.json. Kept inline to avoid bundling
      // a JSON import path that would need a tsconfig flag flip.
      process.stdout.write('0.1.0\n');
      process.exit(0);
    }
  }
  return out;
}

function printHelp(): void {
  process.stdout.write(
    [
      'ariada-mcp-server — Model Context Protocol server for the ariada accessibility scanner',
      '',
      'Usage:',
      '  ariada-mcp-server [--transport stdio|http] [--allow-private]',
      '',
      'Options:',
      '  --transport <stdio|http>    Transport selection (default: stdio)',
      '  --allow-private             Allow scanning RFC 1918 / loopback URLs',
      '  --help, -h                  Show this help',
      '  --version, -V               Print version',
      '',
      'See README.md for the full configuration matrix.',
      '',
    ].join('\n'),
  );
}

const cli = parseArgs(process.argv.slice(2));

if (cli.transport === 'http') {
  process.stderr.write(
    'http transport is scaffolded but not enabled in 0.1.0 — use --transport stdio.\n',
  );
  process.exit(2);
}

const server = new AriadaMcpServer({ allowPrivate: cli.allowPrivate });
void attachStdioTransport({ server }, process.stdin, process.stdout).then(() => {
  process.exit(0);
});
