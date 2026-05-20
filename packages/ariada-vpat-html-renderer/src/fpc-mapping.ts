// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Functional Performance Criteria (FPC) heuristic mapping.
//
// VPAT 2.5 INT Chapter 3 lists eight outcomes-oriented criteria. Each FPC
// fails ("Does Not Support") when at least one WCAG 2.2 Success Criterion
// from its mapping list is itself marked `does-not-support`. A "Partially
// Supports" verdict propagates from any partial WCAG SC in scope. Otherwise
// "Supports".
//
// This is a heuristic — the W3C WCAG-to-FPC mapping does not enumerate
// every edge case. Reviewers may override the derived status by supplying
// an explicit FPC row in `VpatReport` (future schema extension); the
// renderer takes the heuristic as the default.

import type { VpatConformanceStatus, VpatCriterion } from './types.js';

/**
 *
 */
export interface FpcEntry {
 readonly id: string;
 readonly nameKey: string;
 readonly wcagScIds: ReadonlyArray<string>;
}

export const FPC_MAPPING: ReadonlyArray<FpcEntry> = Object.freeze([
 {
 id: 'fpc-without-vision',
 nameKey: 'Without vision',
 wcagScIds: ['1.1.1', '1.3.1', '1.4.1', '2.1.1', '2.4.3', '2.4.6', '4.1.2'],
 },
 {
 id: 'fpc-limited-vision',
 nameKey: 'With limited vision',
 wcagScIds: ['1.4.3', '1.4.4', '1.4.10', '1.4.11', '1.4.12'],
 },
 {
 id: 'fpc-without-colour',
 nameKey: 'Without perception of colour',
 wcagScIds: ['1.4.1'],
 },
 {
 id: 'fpc-without-hearing',
 nameKey: 'Without hearing',
 wcagScIds: ['1.2.1', '1.2.2', '1.2.3', '1.2.5'],
 },
 {
 id: 'fpc-limited-hearing',
 nameKey: 'With limited hearing',
 wcagScIds: ['1.4.7'],
 },
 {
 id: 'fpc-without-speech',
 nameKey: 'Without speech',
 wcagScIds: [],
 },
 {
 id: 'fpc-limited-manipulation',
 nameKey: 'With limited manipulation or strength',
 wcagScIds: ['2.1.1', '2.5.1', '2.5.5', '2.5.7', '2.5.8'],
 },
 {
 id: 'fpc-limited-cognition',
 nameKey: 'With limited reach or cognition',
 wcagScIds: ['2.2.1', '2.2.2', '3.1.1', '3.1.2', '3.2.1', '3.2.2', '3.3.1', '3.3.2'],
 },
]);

/**
 * Derive an FPC conformance status from the set of WCAG criteria evaluations.
 * Pure function — no I/O, deterministic.
 */
export function deriveFpcStatus(
 entry: FpcEntry,
 criteria: ReadonlyArray<VpatCriterion>,
): VpatConformanceStatus {
 if (entry.wcagScIds.length === 0) {
 return 'not-applicable';
 }
 const byId = new Map<string, VpatCriterion>();
 for (const c of criteria) {
 byId.set(c.id, c);
 }
 let hasFail = false;
 let hasPartial = false;
 let hasEvaluated = false;
 for (const scId of entry.wcagScIds) {
 const c = byId.get(scId);
 if (c === undefined) {
 continue;
 }
 if (c.status === 'does-not-support') {
 hasFail = true;
 } else if (c.status === 'partially-supports') {
 hasPartial = true;
 }
 if (c.status !== 'not-evaluated') {
 hasEvaluated = true;
 }
 }
 if (hasFail) {
 return 'does-not-support';
 }
 if (hasPartial) {
 return 'partially-supports';
 }
 if (!hasEvaluated) {
 return 'not-evaluated';
 }
 return 'supports';
}
