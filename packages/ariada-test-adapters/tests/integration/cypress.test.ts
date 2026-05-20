// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Cypress adapter integration test. We stub the `Cypress` + `cy` globals so
 * we can verify the registered command body without booting Cypress
 * (whose runtime cost is multi-second and out of scope for v0.1 unit
 * coverage — see PRD §6.3).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerCypressCommand } from '../../src/cypress/command.js';

import {
  clearFakeScanner,
  installFakeScanner,
  sampleAriaViolation,
} from './_shared.js';

interface StubLog {
  name: string;
  message: string;
}

interface StubCyChainable {
  url(): { then(fn: (value: string) => Promise<unknown>): Promise<unknown> };
  then(fn: (subject: unknown) => Promise<unknown>): Promise<unknown>;
  log(opts: StubLog): void;
}

function buildStubs(url: string) {
  const logs: StubLog[] = [];
  let registeredFn:
    | ((subject: unknown, options?: { severity?: 'serious' }) => Promise<unknown>)
    | null = null;
  const Cypress = {
    Commands: {
      add(
        _name: string,
        _opts: { prevSubject: 'optional' },
        fn: (subject: unknown, options?: { severity?: 'serious' }) => unknown,
      ) {
        registeredFn = fn as typeof registeredFn;
      },
    },
  };
  const cy: StubCyChainable = {
    url: () => ({
      then: async (fn) => fn(url),
    }),
    then: async (fn) => fn(undefined),
    log: (opts) => {
      logs.push(opts);
    },
  };
  return {
    Cypress,
    cy,
    logs,
    get fn() {
      if (!registeredFn) throw new Error('registerCypressCommand was not invoked');
      return registeredFn;
    },
  };
}

describe('Cypress cy.checkA11y command', () => {
  beforeEach(() => installFakeScanner([sampleAriaViolation]));
  afterEach(() => clearFakeScanner());

  it('registers a child command (prevSubject optional) and runs scan via cy.url()', async () => {
    const stubs = buildStubs('https://stub.example');
    registerCypressCommand(stubs.Cypress, stubs.cy);
    await expect(stubs.fn(undefined)).rejects.toThrow(/WCAG/);
    expect(stubs.logs.at(-1)?.name).toBe('checkA11y');
    expect(stubs.logs.at(-1)?.message).toContain('violation');
  });

  it('logs success and resolves when scan is clean', async () => {
    clearFakeScanner();
    installFakeScanner([]);
    const stubs = buildStubs('https://stub.example');
    registerCypressCommand(stubs.Cypress, stubs.cy);
    await stubs.fn(undefined);
    expect(stubs.logs.at(-1)?.message).toContain('accessibility OK');
  });

  it('returns silently if Cypress globals are not present', () => {
    expect(() => registerCypressCommand(undefined, undefined)).not.toThrow();
  });
});
