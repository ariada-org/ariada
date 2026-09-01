// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
export { scan, capture, createScanner } from './scanner.js';
export { createA11yAnalyzer, type CreateA11yAnalyzerOptions } from './a11y-analyzer.js';
export { mapAxeImpact } from './axe-severity.js';
export { launchBrowser, listFrames, type BrowserHandle, type BrowserName } from './cdp.js';
export { guardedGoto, type GuardedNavOptions } from './guarded-nav.js';
export { captureSnapshot, type SnapshotOptions } from './snapshot.js';
export { createPlaywrightBoundingBoxResolver } from './bbox-resolver.js';
export { createLogger, asEngineLogger } from './logger.js';
