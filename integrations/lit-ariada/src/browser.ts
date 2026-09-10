// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/browser.js` and `dist/browser.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// the rebuild check.
//
// WAITING FOR THE ELEMENT IS THE WHOLE PROBLEM THIS SOLVES. A web component
// renders asynchronously, so a scan started too early sees an empty shell and
// reports it as accessible. The wait is three separate things and each is
// necessary: the element's own render promise, one animation frame for the
// browser to lay it out, and then a check that an open shadow root exists and is
// not empty. Without the last one, an element whose render silently produced
// nothing passes.
//
// A closed shadow root fails here rather than being scanned, and that is honest
// rather than restrictive: nothing outside can read it, so anything reported
// about it would be about the wrapper.
//
// Property names are set through Reflect with three names refused outright,
// because a test fixture's property bag becomes a write onto a live object.
//
// The command's response is validated before use. It crosses from the runner's
// process into the page as plain data, and a page that trusted it would report a
// scan that never happened.

import { LIT_ARIADA_COMMAND } from './command.js';
import type { LitAriadaCommandPayload, LitScanResult } from './types.js';

export interface LitLikeElement extends HTMLElement {
  readonly updateComplete?: Promise<unknown>;
}

export interface MountLitElementOptions {
  readonly container?: Element;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export type ExecuteServerCommand = (command: string, payload?: unknown) => Promise<unknown>;

export interface ScanMountedLitOptions extends LitAriadaCommandPayload {
  readonly failOnFindings?: boolean;
}

const CUSTOM_ELEMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

async function awaitLitRender(element: LitLikeElement): Promise<void> {
  if (element.updateComplete === undefined || typeof element.updateComplete.then !== 'function') {
    throw new TypeError(`${element.localName} is not a rendered Lit element with updateComplete`);
  }
  await element.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (element.shadowRoot === null || element.shadowRoot.childNodes.length === 0) {
    throw new Error(`${element.localName} did not render an open, non-empty shadow root`);
  }
}

export async function mountLitElement(tagName: string, options: MountLitElementOptions = {}): Promise<LitLikeElement> {
  const normalized = tagName.trim().toLowerCase();
  if (!CUSTOM_ELEMENT.test(normalized)) {
    throw new TypeError('tagName must be a custom-element name containing a hyphen');
  }
  const element = document.createElement(normalized) as LitLikeElement;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  for (const [name, value] of Object.entries(options.properties ?? {})) {
    if (FORBIDDEN_PROPERTIES.has(name)) throw new TypeError(`Unsafe property name: ${name}`);
    Reflect.set(element, name, value);
  }
  (options.container ?? document.body).append(element);
  await awaitLitRender(element);
  return element;
}

function commandResult(value: unknown): LitScanResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${LIT_ARIADA_COMMAND} returned a non-object response`);
  }
  const source = value as Record<string, unknown>;
  const decision = source['decision'];
  if (source['schema'] !== 'lit-ariada-result.v1' ||
    !Array.isArray(source['componentFindings']) ||
    typeof decision !== 'object' ||
    decision === null) {
    throw new Error(`${LIT_ARIADA_COMMAND} returned an invalid response contract`);
  }
  return value as LitScanResult;
}

export async function scanMountedLitElement(
  element: LitLikeElement,
  executeServerCommand: ExecuteServerCommand,
  options: ScanMountedLitOptions,
): Promise<LitScanResult> {
  await awaitLitRender(element);
  const componentSelector = options.componentSelector.trim().toLowerCase();
  if (element.localName !== componentSelector) {
    throw new TypeError(`Mounted element ${element.localName} does not match componentSelector ${componentSelector}`);
  }
  const result = commandResult(await executeServerCommand(LIT_ARIADA_COMMAND, {
    fixtureUrl: options.fixtureUrl,
    componentSelector,
    ...(options.browser === undefined ? {} : { browser: options.browser }),
    ...(options.severityThreshold === undefined
      ? {}
      : { severityThreshold: options.severityThreshold }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  }));
  if ((options.failOnFindings ?? true) && result.decision.exitCode === 1) {
    throw new Error(`Ariada found ${result.componentFindings.length} component finding(s) at or above ${result.decision.failOnSeverity}`);
  }
  return result;
}
