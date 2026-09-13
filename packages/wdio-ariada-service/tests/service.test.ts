// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// The service is the part of this package that decides WHEN a scan happens and
// what is done with the answer, and it is testable without a browser because the
// scan itself is replaced here. The capture belongs to the adapter and needs a
// real session; the decisions do not.
//
// The case worth reading first is the one about the re-entrancy flag being
// cleared when the policy raises. The service refuses to scan while a scan is in
// flight, which is right — the hook it runs from can fire during its own work.
// If that flag were left standing after a failure, every later scan in the run
// would return without doing anything and without saying so, and the report at
// the end would show one violation on a suite that has hundreds. A test suite
// that quietly stops testing is the worst shape this package could take, so it
// is held on its own.

import { describe, expect, it, vi, beforeEach } from 'vitest';

import AriadaService, { AriadaPolicyError } from '../src/index.js';
import type { AriadaWdioBrowser } from '../src/types.js';

const runAriadaScan = vi.hoisted(() => vi.fn());
vi.mock('../src/scan-adapter.js', () => ({ runAriadaScan }));

type Zapis = Record<string, unknown>;

function itog(over: Zapis = {}): Zapis {
  return {
    url: 'https://example.org/',
    scanId: 's-1',
    exitCode: 0,
    mode: 'ax-tree',
    domSource: 'cdp',
    summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
    findings: [],
    blockingCount: 0,
    outputDir: '/tmp/out',
    artifactPath: '/tmp/out/scan.json',
    ...over,
  };
}

function nahodka(severity: string, ruleId = 'color-contrast'): Zapis {
  return { ruleId, severity, message: 'm', element: { selector: 'div.a' } };
}

const brauzer = {} as AriadaWdioBrowser;

/**
 * The error a promise rejected with, typed as an error.
 *
 * Written out rather than `.catch((e: Error) => e)`: that gives the compiler a
 * union with the resolved value, which here is void, and every reading of the
 * message becomes an error about a property on void.
 */
async function pojmat(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected the promise to reject, and it did not');
}

beforeEach(() => {
  runAriadaScan.mockReset();
  runAriadaScan.mockResolvedValue(itog());
});

/** A service already told about its browser, with its log captured. */
function sluzhba(options: Zapis = {}) {
  const stroki: string[] = [];
  const s = new AriadaService({ log: (l: string) => void stroki.push(l), ...options } as never);
  s.before(undefined, [], brauzer);
  return { s, stroki };
}

describe('knowing whether it may scan at all', () => {
  it('refuses to scan before it has been given a session, and says which hook did not run', async () => {
    const s = new AriadaService({ log: () => {} } as never);
    await expect(s.afterTest({} as never, undefined, {} as never)).rejects.toThrow(
      /before hook did not run/,
    );
  });

  it('scans after a test by default', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: 'a test' } as never, undefined, {} as never);
    expect(runAriadaScan).toHaveBeenCalledTimes(1);
  });

  it('does not scan after a test when told not to', async () => {
    const { s } = sluzhba({ scanAfterTest: false });
    await s.afterTest({ title: 'a test' } as never, undefined, {} as never);
    expect(runAriadaScan).not.toHaveBeenCalled();
  });

  it('does not scan after a command unless asked', async () => {
    const { s } = sluzhba();
    await s.afterCommand('click', undefined, undefined);
    expect(runAriadaScan).not.toHaveBeenCalled();
  });

  it('scans after every command when told true', async () => {
    const { s } = sluzhba({ scanAfterCommand: true });
    await s.afterCommand('click', undefined, undefined);
    expect(runAriadaScan).toHaveBeenCalledTimes(1);
  });

  it('scans only after the commands it was given by name', async () => {
    const { s } = sluzhba({ scanAfterCommand: ['navigateTo'] });
    await s.afterCommand('click', undefined, undefined);
    expect(runAriadaScan).not.toHaveBeenCalled();
    await s.afterCommand('navigateTo', undefined, undefined);
    expect(runAriadaScan).toHaveBeenCalledTimes(1);
  });
});

describe('not scanning inside its own scan', () => {
  it('declines a second scan while one is in flight', async () => {
    // The hook this runs from can fire because of the scan itself.
    const { s } = sluzhba({ scanAfterCommand: true });
    runAriadaScan.mockImplementation(async () => {
      await s.afterCommand('getUrl', undefined, undefined);
      return itog();
    });
    await s.afterCommand('navigateTo', undefined, undefined);
    expect(runAriadaScan).toHaveBeenCalledTimes(1);
  });

  it('declines it on the path that has no guard of its own either', async () => {
    // Two guards stand in front of this, one per hook, and only one of them is
    // in the scan itself. The command hook checks before it calls, so a test
    // written through that hook holds the outer guard and leaves the inner one
    // unexercised — which is what a removal check found: taking the inner guard
    // out changed nothing. The test hook does not check, so it reaches it.
    const { s } = sluzhba();
    runAriadaScan.mockImplementation(async () => {
      await s.afterTest({ title: 'nested' } as never, undefined, {} as never);
      return itog();
    });
    await s.afterTest({ title: 'outer' } as never, undefined, {} as never);
    expect(runAriadaScan).toHaveBeenCalledTimes(1);
  });

  it('is ready to scan again after one that raised on policy', async () => {
    // Held on its own, because the alternative is a suite that quietly stops
    // testing: every later scan would return without doing anything and without
    // saying so, and the report would show one violation on a run with hundreds.
    const { s } = sluzhba();
    runAriadaScan.mockResolvedValue(itog({ exitCode: 1, blockingCount: 1, findings: [nahodka('critical')] }));
    await expect(s.afterTest({ title: 'one' } as never, undefined, {} as never)).rejects.toBeInstanceOf(
      AriadaPolicyError,
    );
    runAriadaScan.mockResolvedValue(itog());
    await s.afterTest({ title: 'two' } as never, undefined, {} as never);
    expect(runAriadaScan).toHaveBeenCalledTimes(2);
  });

  it('is ready to scan again after one that threw for any other reason', async () => {
    const { s } = sluzhba();
    runAriadaScan.mockRejectedValueOnce(new Error('capture failed'));
    await expect(s.afterTest({ title: 'one' } as never, undefined, {} as never)).rejects.toThrow(
      /capture failed/,
    );
    await s.afterTest({ title: 'two' } as never, undefined, {} as never);
    expect(runAriadaScan).toHaveBeenCalledTimes(2);
  });
});

describe('where each scan writes', () => {
  function kudaPisali(): string {
    return String((runAriadaScan.mock.calls.at(-1)?.[1] as Zapis)['outputDir']);
  }

  it('numbers the runs so two scans never share a directory', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: 'first' } as never, undefined, {} as never);
    const a = kudaPisali();
    await s.afterTest({ title: 'second' } as never, undefined, {} as never);
    expect(kudaPisali()).not.toBe(a);
    expect(a).toMatch(/001-aftertest-first$/);
    expect(kudaPisali()).toMatch(/002-aftertest-second$/);
  });

  it('turns a title into something a filesystem accepts', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: 'Login / sign-up  ✱ flow!' } as never, undefined, {} as never);
    expect(kudaPisali()).toMatch(/001-aftertest-login-sign-up-flow$/);
  });

  it('gives a nameless run a name rather than an empty path segment', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: '✱✱✱' } as never, undefined, {} as never);
    expect(kudaPisali()).toMatch(/001-aftertest-scan$/);
  });

  it('shortens a title that would otherwise make an unusable path', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: 'a'.repeat(200) } as never, undefined, {} as never);
    const hvost = kudaPisali().split('/').at(-1) ?? '';
    expect(hvost.length).toBeLessThanOrEqual('001-aftertest-'.length + 80);
  });

  it('prefers the full title of a test over its own short one', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: 'short', fullTitle: 'suite short' } as never, undefined, {} as never);
    expect(kudaPisali()).toMatch(/aftertest-suite-short$/);
  });

  it('falls back to a stated name when a test has neither', async () => {
    const { s } = sluzhba();
    await s.afterTest({} as never, undefined, {} as never);
    expect(kudaPisali()).toMatch(/aftertest-unnamed-test$/);
  });

  it('writes beneath the directory it was configured with', async () => {
    const { s } = sluzhba({ outputDir: '/tmp/somewhere' });
    await s.afterTest({ title: 'x' } as never, undefined, {} as never);
    expect(kudaPisali()).toMatch(/^\/tmp\/somewhere\//);
  });
});

describe('what it does with the answer', () => {
  it('keeps every result, with the hook and label that produced it', async () => {
    const { s } = sluzhba();
    await s.afterTest({ title: 'a test' } as never, undefined, {} as never);
    expect(s.results).toHaveLength(1);
    expect(s.results[0]).toMatchObject({ hook: 'afterTest', label: 'a test' });
  });

  it('attaches the result to the objects the runner passed in', async () => {
    const test: Zapis = { title: 'a test' };
    const outcome: Zapis = {};
    const { s } = sluzhba();
    await s.afterTest(test as never, undefined, outcome as never);
    expect(test['ariada']).toBe(s.results[0]);
    expect(outcome['ariada']).toBe(s.results[0]);
  });

  it('still reports when the runner hands it something it cannot write to', async () => {
    // Frozen runner objects are ordinary. Losing the whole scan over one is not.
    const zamorozhennyy = Object.freeze({ title: 'a test' });
    const { s, stroki } = sluzhba();
    await expect(
      s.afterTest(zamorozhennyy as never, undefined, {} as never),
    ).resolves.toBeUndefined();
    expect(stroki[0]).toMatch(/^ARIADA_WDIO_REPORT /);
  });

  it('prints one machine-readable line per scan', async () => {
    const { s, stroki } = sluzhba();
    await s.afterTest({ title: 'a test' } as never, undefined, {} as never);
    expect(stroki).toHaveLength(1);
    const [, json] = stroki[0]!.split('ARIADA_WDIO_REPORT ');
    expect(JSON.parse(json!)).toMatchObject({ hook: 'afterTest', url: 'https://example.org/' });
  });

  it('hands the result to a caller that asked for it, and waits for them', async () => {
    const poryadok: string[] = [];
    const { s } = sluzhba({
      onResult: async () => {
        await new Promise((r) => setTimeout(r, 5));
        poryadok.push('onResult');
      },
    });
    await s.afterTest({ title: 'a test' } as never, undefined, {} as never);
    poryadok.push('after');
    expect(poryadok).toEqual(['onResult', 'after']);
  });
});

describe('the policy', () => {
  it('raises by default when the scan says the gate failed', async () => {
    const { s } = sluzhba();
    runAriadaScan.mockResolvedValue(itog({ exitCode: 1, blockingCount: 2, findings: [nahodka('critical')] }));
    await expect(s.afterTest({ title: 't' } as never, undefined, {} as never)).rejects.toBeInstanceOf(
      AriadaPolicyError,
    );
  });

  it('stays quiet when told not to fail, and still records the result', async () => {
    const { s } = sluzhba({ failOnViolation: false });
    runAriadaScan.mockResolvedValue(itog({ exitCode: 1, blockingCount: 2 }));
    await expect(s.afterTest({ title: 't' } as never, undefined, {} as never)).resolves.toBeUndefined();
    expect(s.results).toHaveLength(1);
  });

  it('says how many blocked, where, and where the report is', async () => {
    const { s } = sluzhba();
    runAriadaScan.mockResolvedValue(
      itog({ exitCode: 1, blockingCount: 3, findings: [nahodka('serious', 'image-alt')] }),
    );
    const oshibka = await pojmat(s.afterTest({ title: 't' } as never, undefined, {} as never));
    expect(oshibka.message).toContain('3 blocking violation');
    expect(oshibka.message).toContain('https://example.org/');
    expect(oshibka.message).toContain('image-alt [serious] div.a');
    expect(oshibka.message).toContain('/tmp/out/scan.json');
  });

  it('names ten findings at most, rather than a wall of them', async () => {
    const { s } = sluzhba();
    const mnogo = Array.from({ length: 15 }, (_, i) => nahodka('critical', `r${i}`));
    runAriadaScan.mockResolvedValue(itog({ exitCode: 1, blockingCount: 15, findings: mnogo }));
    const oshibka = await pojmat(s.afterTest({ title: 't' } as never, undefined, {} as never));
    expect(oshibka.message).toContain('r9');
    expect(oshibka.message).not.toContain('r10 ');
  });

  it('leaves the minor findings out of the message but not out of the count', async () => {
    const { s } = sluzhba();
    runAriadaScan.mockResolvedValue(
      itog({ exitCode: 1, blockingCount: 1, findings: [nahodka('minor', 'landmark')] }),
    );
    const oshibka = await pojmat(s.afterTest({ title: 't' } as never, undefined, {} as never));
    expect(oshibka.message).toContain('1 blocking violation');
    expect(oshibka.message).not.toContain('landmark');
  });

  it('carries the whole result on the error, so a caller need not parse the message', async () => {
    const { s } = sluzhba();
    runAriadaScan.mockResolvedValue(itog({ exitCode: 1, blockingCount: 1 }));
    const oshibka = (await s
      .afterTest({ title: 't' } as never, undefined, {} as never)
      .catch((e: unknown) => e)) as AriadaPolicyError;
    expect(oshibka.result).toMatchObject({ blockingCount: 1, hook: 'afterTest' });
  });
});

describe('passing the threshold along', () => {
  it('gives the scan the threshold it was configured with', async () => {
    const { s } = sluzhba({ severityThreshold: 'critical' });
    await s.afterTest({ title: 't' } as never, undefined, {} as never);
    expect((runAriadaScan.mock.calls[0]?.[1] as Zapis)['severityThreshold']).toBe('critical');
  });

  it('says nothing about the threshold when it was given none', async () => {
    // Absent rather than undefined: the adapter's own default is what should
    // apply, and an explicit undefined would look like a caller's choice.
    const { s } = sluzhba();
    await s.afterTest({ title: 't' } as never, undefined, {} as never);
    const options = runAriadaScan.mock.calls[0]?.[1] as Zapis;
    expect(Object.hasOwn(options, 'severityThreshold')).toBe(false);
  });
});
