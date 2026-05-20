// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
export {
  captureBrowserSnapshot,
  type CaptureBrowserSnapshotOpts,
  type ChromeDebugger,
  type DebuggerTarget,
} from './dom-snapshot.js';
export { createDomBoundingBoxResolver } from './bbox-resolver.js';
export { scanCurrentDocument, type ScanCurrentDocumentOpts } from './browser-runner.js';
