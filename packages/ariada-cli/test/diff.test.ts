// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { run } from '../src/parser.js';

class CaptureStream {
  chunks: string[] = [];
  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }
  text(): string {
    return this.chunks.join('');
  }
}

async function writeScanEvent(dir: string, name: string, findings: unknown[]): Promise<string> {
  const p = join(dir, name);
  await writeFile(
    p,
    JSON.stringify({
      scan_id: name,
      scan_root_hash: 'a'.repeat(64),
      findings,
    }),
    'utf8',
  );
  return p;
}

describe('ariada diff CLI', () => {
  it('--help exits 0 and lists subcommands', async () => {
    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const code = await run(['diff', '--help'], {
       
      stdout: stdout as any,
       
      stderr: stderr as any,
    });
    expect(code).toBe(0);
    const out = stdout.text();
    expect(out).toContain('classify');
    expect(out).toContain('gate');
    expect(out).toContain('inspect');
    expect(out).toContain('explain');
    expect(out).toContain('replay');
    expect(out).toContain('exempt');
  });

  it('classify writes a DiffResult with engine=stub', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-diff-'));
    const head = await writeScanEvent(dir, 'head.json', [
      {
        ruleId: 'wcag2/1.1.1',
        jurisdictionTags: ['WCAG2.2-AA'],
        severity: 'serious',
        selector: 'img',
      },
    ]);
    const base = await writeScanEvent(dir, 'base.json', []);
    const out = join(dir, 'diff.json');
    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const code = await run(
      ['diff', 'classify', '--head', head, '--base', base, '--out', out],
      {
         
        stdout: stdout as any,
         
        stderr: stderr as any,
      },
    );
    expect(code).toBe(0);
    const diff = JSON.parse(await readFile(out, 'utf8'));
    expect(diff.engine_info.classifier).toBe('stub');
    expect(diff.counts.new).toBe(1);
  });

  it('gate produces a GateDecision and pass for empty diff', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-diff-'));
    const head = await writeScanEvent(dir, 'head.json', []);
    const base = await writeScanEvent(dir, 'base.json', []);
    const diffPath = join(dir, 'diff.json');
    const decPath = join(dir, 'decision.json');

    const out1 = new CaptureStream();
    const err1 = new CaptureStream();
    const c1 = await run(
      ['diff', 'classify', '--head', head, '--base', base, '--out', diffPath],
       
      { stdout: out1 as any, stderr: err1 as any },
    );
    expect(c1).toBe(0);

    const out2 = new CaptureStream();
    const err2 = new CaptureStream();
    const c2 = await run(
      ['diff', 'gate', '--diff', diffPath, '--out', decPath],
       
      { stdout: out2 as any, stderr: err2 as any },
    );
    expect(c2).toBe(0);
    const decision = JSON.parse(await readFile(decPath, 'utf8'));
    expect(decision.result).toBe('pass');
  });

  it('gate exits 1 on new critical finding', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-diff-'));
    const head = await writeScanEvent(dir, 'head.json', [
      {
        ruleId: 'wcag2/1.1.1',
        jurisdictionTags: ['WCAG2.2-AA'],
        severity: 'critical',
        selector: 'img',
      },
    ]);
    const base = await writeScanEvent(dir, 'base.json', []);
    const diffPath = join(dir, 'diff.json');
    const decPath = join(dir, 'decision.json');
    const sink = new CaptureStream();
    await run(['diff', 'classify', '--head', head, '--base', base, '--out', diffPath], {
       
      stdout: sink as any,
       
      stderr: sink as any,
    });
    const sink2 = new CaptureStream();
    const code = await run(['diff', 'gate', '--diff', diffPath, '--out', decPath], {
       
      stdout: sink2 as any,
       
      stderr: sink2 as any,
    });
    expect(code).toBe(1);
  });

  it('inspect prints a human summary', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-diff-'));
    const head = await writeScanEvent(dir, 'head.json', []);
    const base = await writeScanEvent(dir, 'base.json', []);
    const diffPath = join(dir, 'diff.json');
    const sink = new CaptureStream();
    await run(['diff', 'classify', '--head', head, '--base', base, '--out', diffPath], {
       
      stdout: sink as any,
       
      stderr: sink as any,
    });
    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const code = await run(['diff', 'inspect', diffPath], {
       
      stdout: stdout as any,
       
      stderr: stderr as any,
    });
    expect(code).toBe(0);
    expect(stdout.text()).toContain('diff_id:');
    expect(stdout.text()).toContain('counts:');
  });

  it('exempt list prints a SaaS-pointer message', async () => {
    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const code = await run(['diff', 'exempt', 'list'], {
       
      stdout: stdout as any,
       
      stderr: stderr as any,
    });
    expect(code).toBe(0);
    expect(stdout.text()).toContain('dashboard');
  });
});
