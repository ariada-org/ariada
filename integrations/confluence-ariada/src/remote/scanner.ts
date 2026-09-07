// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/scanner.js` and its declaration. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The scanner and the browser driver are imported when a scan is asked for
// rather than when this module loads. They pull a browser in behind them, and a
// service that answers a health check should not need one to start.
//
// Two ceilings, not one. The caller's timeout is honoured up to eighteen
// seconds, because this runs behind a request somebody is waiting on and a
// setting that lets it wait forever is a setting that will. Diagnostic output is
// kept to thirty-two kilobytes for the same reason it is kept at all: it goes
// into an error message a person reads.
//
// The temporary directory is removed in a `finally`, and so is the document
// server. A scan that throws part-way still leaves the machine as it found it.

import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeCliReport } from '../shared/normalize.js';
import type { PageDescriptor, ScanResult, Severity } from '../shared/types.js';

import { renderDocument, serveDocument } from './html-server.js';


function boundedSink(limit = 32_768): { stream: { write(chunk: unknown): boolean }; text: () => string } {
  let value = '';
  return {
    stream: { write(chunk: unknown) { if (value.length < limit)
            value += String(chunk).slice(0, limit - value.length); return true; } },
    text: () => value,
  };
}

export async function scanHtmlDocument(
  page: PageDescriptor,
  bodyHtml: string,
  options: { severityThreshold?: Severity; timeoutMs?: number } = {},
): Promise<ScanResult> {
  const work = await mkdtemp(join(tmpdir(), 'confluence-ariada-'));
  const output = join(work, 'output');
  await mkdir(output);
  const served = await serveDocument(renderDocument(page, bodyHtml));
  const stdout = boundedSink();
  const stderr = boundedSink();
  try {
    const [{ runScan }, { scan }] = await Promise.all([
      import('@ariada-org/cli'),
      import('@ariada-org/core-playwright'),
    ]);
    const exitCode = await runScan(served.url, {
      outputDir: output,
      browser: 'chromium',
      format: 'json',
      severityThreshold: options.severityThreshold ?? 'moderate',
      timeoutMs: Math.min(options.timeoutMs ?? 15_000, 18_000),
    }, stdout.stream, stderr.stream, (url, scanOptions) => scan(url, { ...scanOptions, allowPrivateNetwork: true }));
    if (exitCode !== 0 && exitCode !== 1) {
      throw new Error(`Ariada scanner exited ${exitCode}: ${stderr.text() || stdout.text()}`);
    }
    const artifact = await readFile(join(output, 'scan.json'), 'utf8');
    return normalizeCliReport(artifact, page, exitCode, options.severityThreshold ?? 'moderate');
  }
  finally {
    await served.close();
    await rm(work, { recursive: true, force: true });
  }
}
