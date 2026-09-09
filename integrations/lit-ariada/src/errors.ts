// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/errors.js` and `dist/errors.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the body is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Three codes, and they are three different people's problems: a bad input is
// whoever wrote the test, a failed scanner is whoever runs the pipeline, an
// invalid artifact is whoever owns the scanner. The details object carries what
// each of them needs without putting it in the message, which is read by all
// three.

export type LitAriadaErrorCode = 'INVALID_INPUT' | 'SCANNER_FAILED' | 'SCAN_ARTIFACT_INVALID';

export class LitAriadaError extends Error {
  readonly code: LitAriadaErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: LitAriadaErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'LitAriadaError';
    this.code = code;
    this.details = details;
  }
}
