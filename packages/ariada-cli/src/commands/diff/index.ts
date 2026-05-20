// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Public entry for the `ariada diff` subcommand surface. Each command
// is exported as a `runX` async function returning a CLI exit code, so
// they can be wired into the commander parser or invoked
// programmatically from tests.

export { runDiffClassify, type DiffClassifyOptions } from './classify.js';
export { runDiffGate, type DiffGateOptions } from './gate.js';
export { runDiffInspect, type DiffInspectOptions } from './inspect.js';
export { runDiffExplain, type DiffExplainOptions } from './explain.js';
export { runDiffReplay, type DiffReplayOptions } from './replay.js';
export { runDiffExempt, type DiffExemptOptions } from './exempt.js';
