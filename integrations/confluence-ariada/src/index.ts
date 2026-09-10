// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// the rebuild check.
//
// Four functions and the shapes they speak in. The normaliser is exported on its
// own because it is the only part with no network and no browser in it, and so
// the only part somebody can test by handing it a document.

export { normalizeCliReport } from './shared/normalize.js';
export type { Finding, ForgeClaims, PageDescriptor, ScanResult, Severity } from './shared/types.js';
export { handleScanRequest } from './remote/handler.js';
export { scanHtmlDocument } from './remote/scanner.js';
export { startRemoteServer } from './remote/server.js';
