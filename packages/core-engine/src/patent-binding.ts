// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Comment-only marker symbol. Reserved for future introspection hooks that
 * may attach metadata to exports via a registry-side grep check; this is
 * NOT a runtime decorator and has no behavioural effect at the call site.
 */
export const PATENT_BINDING_MARKER = Symbol.for('ariada.patentBinding');
