#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * content-gate CLI — evaluates files against the OSS-surface content-policy
 * profile and prints a per-file verdict (pass / warn / fail + findings).
 *
 * Usage:
 *   content-gate <file> [<file> ...]
 *
 * Exits non-zero when at least one file FAIL verdict is produced.
 * Exports `runGate` for unit-testing without spawning a subprocess.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ContentFinding, ContentGateDecision } from './types.js';

import { builtinPacks, evaluateContent, ossSurfaceProfile } from './index.js';

// ---------------------------------------------------------------------------
// Public core logic (exported so tests can exercise without process.exit)
// ---------------------------------------------------------------------------

/** Per-file evaluation result pairing the file path with its gate decision. */
export interface FileVerdict {
  filePath: string;
  decision: ContentGateDecision;
}

/** Aggregate output of a multi-file gate run. */
export interface GateRunResult {
  verdicts: FileVerdict[];
  /** True when at least one file has result === 'fail'. */
  hasFailure: boolean;
}

/**
 * Run the content gate against one or more file paths.
 *
 * Reads each file from disk, evaluates it against `ossSurfaceProfile` with
 * `builtinPacks`, and returns the per-file verdicts plus an aggregate
 * failure flag. Throws if a file cannot be read.
 */
export function runGate(filePaths: string[]): GateRunResult {
  const verdicts: FileVerdict[] = [];

  for (const rawPath of filePaths) {
    const filePath = resolve(rawPath);
    const content = readFileSync(filePath, 'utf8');
    const decision = evaluateContent(content, ossSurfaceProfile, builtinPacks);
    verdicts.push({ filePath, decision });
  }

  const hasFailure = verdicts.some((v) => v.decision.result === 'fail');
  return { verdicts, hasFailure };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const ICON: Record<string, string> = { pass: '✅', warn: '⚠️', fail: '❌' };

function formatFinding(filePath: string, finding: ContentFinding): string {
  return `  ${filePath}:${finding.line}  [${finding.category}]  "${finding.matchedText}"`;
}

function printVerdict(verdict: FileVerdict): void {
  const { filePath, decision } = verdict;
  const icon = ICON[decision.result] ?? '?';
  const counts = `fail=${decision.counts.fail} warn=${decision.counts.warn} info=${decision.counts.info}`;
  console.log(`${icon} ${filePath}  (${decision.result})  ${counts}`);
  for (const f of decision.findings) {
    console.log(formatFinding(filePath, f));
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('usage: content-gate <file> [<file> ...]');
    process.exit(1);
  }

  let result: GateRunResult;
  try {
    result = runGate(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`content-gate error: ${message}`);
    process.exit(2);
  }

  for (const verdict of result.verdicts) {
    printVerdict(verdict);
  }

  if (result.hasFailure) {
    process.exit(1);
  }
}

// Only run when invoked directly (not when imported as a module).
// In Node.js ESM, compare the current module's file path against argv[1].
const currentFile = fileURLToPath(import.meta.url);
const entryFile = resolve(process.argv[1] ?? '');
if (currentFile === entryFile) {
  main();
}
