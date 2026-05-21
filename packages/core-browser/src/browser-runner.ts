// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  createConsoleLogger,
  runOrchestration,
  type DomainAnalyzer,
  type Logger,
  type ScanEventEmitter,
  type ScanResult,
} from '@ariada-org/core-engine';

import { createDomBoundingBoxResolver } from './bbox-resolver.js';
import { captureBrowserSnapshot, type DebuggerTarget } from './dom-snapshot.js';

/**
 *
 */
export interface ScanCurrentDocumentOpts {
  scanId?: string;
  document: Document;
  url?: string;
  analyzers?: DomainAnalyzer[];
  emitter?: ScanEventEmitter;
  logger?: Logger;
  axDebugger?: DebuggerTarget;
  elementIter?: boolean;
}

/**
 * In-browser equivalent of `@ariada-org/core-playwright`'s `scan()`. Captures a
 * UnifiedSnapshot from the live `document`, runs the same engine
 * orchestration, emits the same locked ScanEvent stream. No Node, no
 * Playwright, no pino in the bundle.
 *
 */
export async function scanCurrentDocument(opts: ScanCurrentDocumentOpts): Promise<ScanResult> {
  const scanId = opts.scanId ?? generateScanId();
  const startedAt = Date.now();
  const logger = opts.logger ?? createConsoleLogger();
  const childLogger = logger.child({ scanId });

  const snapshot = await captureBrowserSnapshot({
    document: opts.document,
    scanId,
    ...(opts.url !== undefined ? { url: opts.url } : {}),
    ...(opts.axDebugger !== undefined ? { axDebugger: opts.axDebugger } : {}),
  });

  const analyzers = opts.analyzers ?? [];
  const bboxResolver = createDomBoundingBoxResolver(opts.document);

  return runOrchestration({
    scanId,
    url: snapshot.url,
    startedAt,
    snapshot,
    analyzers,
    page: opts.document,
    logger: childLogger,
    bboxResolver,
    ...(opts.emitter !== undefined ? { emitter: opts.emitter } : {}),
    ...(opts.elementIter !== undefined ? { elementIter: opts.elementIter } : {}),
  });
}

/**
 * ULID-shaped scan id generator that doesn't pull in the `ulid` package — the
 * extension bundle stays tiny. We use Crockford base32 encoding of (timestamp
 * + 80 random bits), padded to ULID's 26-char width and uppercased to match
 * the regex consumers like `clamper` rely on.
 */
function generateScanId(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const time = Date.now();
  const timeChars: string[] = [];
  let t = time;
  for (let i = 9; i >= 0; i--) {
    const idx = Number(BigInt(t) & 31n);
    timeChars.push(ENCODING[idx] ?? '0');
    t = Math.floor(t / 32);
  }
  timeChars.reverse();

  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let randomChars = '';
  let bitsAccumulator = 0;
  let bitCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    bitsAccumulator = (bitsAccumulator << 8) | (bytes[i] ?? 0);
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      const idx = (bitsAccumulator >>> bitCount) & 31;
      randomChars += ENCODING[idx] ?? '0';
    }
  }
  randomChars = randomChars.slice(0, 16);
  return timeChars.join('') + randomChars;
}
