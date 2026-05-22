// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile, writeFile } from 'node:fs/promises';

import { classifyStub } from '@ariada-org/diff-stub';

import { CliError, emitError } from '../../errors.js';
import {
  EXIT_OK,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from '../../exit-codes.js';

/**
 *
 */
export interface DiffClassifyOptions {
  head: string;
  base: string;
  engine?: 'stub' | 'canonical';
  out?: string;
  diffId?: string;
  computedAt?: string;
}

interface ScanEventLite {
  scan_id?: string;
  scan_root_hash?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findings?: any[];
}

/**
 * Read a ScanEvent JSON file. The stub classifier consumes the
 * `findings` array; we tolerate missing top-level metadata by
 * synthesising stable placeholders.
 */
async function readScanEvent(path: string): Promise<ScanEventLite> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`scan event at ${path} is not an object`);
  }
  return parsed as ScanEventLite;
}

/**
 * Run the differential classifier. The OSS path uses
 * `@ariada-org/diff-stub`; the `canonical` engine is not available from
 * the OSS CLI and exits unimplemented when requested.
 */
export async function runDiffClassify(
  options: DiffClassifyOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  const engine = options.engine ?? 'stub';
  if (engine !== 'stub' && engine !== 'canonical') {
    emitError(
      new CliError('E_INVALID_OPTION', `Unknown --engine value: ${engine}`, {
        allowed: ['stub', 'canonical'],
      }),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  if (engine === 'canonical') {
    emitError(
      new CliError(
        'E_INVALID_OPTION',
        'engine=canonical requires the SaaS engine; the OSS CLI ships engine=stub only',
      ),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  try {
    const head = await readScanEvent(options.head);
    const base = await readScanEvent(options.base);

    const diff = classifyStub({
      headFindings: head.findings ?? [],
      baseFindings: base.findings ?? [],
      diffId: options.diffId ?? `01HV${Date.now().toString(36).toUpperCase()}`,
      computedAt: options.computedAt ?? new Date().toISOString(),
      head: {
        scan_id: head.scan_id ?? 'head',
        scan_root_hash: head.scan_root_hash ?? '0'.repeat(64),
      },
      base: {
        scan_id: base.scan_id ?? 'base',
        scan_root_hash: base.scan_root_hash ?? '0'.repeat(64),
      },
    });

    const json = JSON.stringify(diff, null, 2);
    if (options.out) {
      await writeFile(options.out, json + '\n', 'utf8');
      stdout.write(`wrote ${options.out}\n`);
    } else {
      stdout.write(json + '\n');
    }
    return EXIT_OK;
  } catch (err) {
    emitError(
      new CliError(
        'E_INTERNAL',
        err instanceof Error ? err.message : String(err),
      ),
      stderr,
    );
    return EXIT_RUNTIME_ERROR;
  }
}
