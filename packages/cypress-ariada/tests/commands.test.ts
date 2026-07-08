// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { registerAriadaCommand } from '../src/commands.js';
import type { AriadaScanResult, AriadaScanTaskPayload } from '../src/types.js';

describe('registerAriadaCommand', () => {
  it('registers a queueable optional-subject Cypress command', () => {
    let registered:
      | ((subject: unknown, options?: { severityThreshold?: 'moderate' }) => unknown)
      | undefined;
    const logs: string[] = [];
    const Cypress = {
      Commands: {
        add(name: string, options: { prevSubject: 'optional' }, fn: typeof registered) {
          expect(name).toBe('ariadaScan');
          expect(options.prevSubject).toBe('optional');
          registered = fn;
        },
      },
      log({ message }: { message: string }) {
        logs.push(message);
      },
    };
    const cy = {
      url() {
        return { then: (fn: (url: string) => unknown) => fn('https://example.test') };
      },
      task(_event: 'ariada:scan', payload: AriadaScanTaskPayload) {
        expect(payload.url).toBe('https://example.test');
        return {
          then: (fn: (result: AriadaScanResult) => unknown) =>
            fn({
              url: payload.url,
              exitCode: 0,
              mode: 'ax-tree',
              summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
              findings: [],
              blockingCount: 0,
              message: 'ok',
              outputDir: '.',
            }),
        };
      },
    };

    registerAriadaCommand(Cypress, cy);
    expect(registered).toBeTypeOf('function');
    expect(registered?.('subject')).toBe('subject');
    expect(logs).toEqual(['0 blocking violations (ax-tree)']);
  });
});
