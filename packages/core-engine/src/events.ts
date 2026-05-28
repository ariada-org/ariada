// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Locked ScanEvent contract — consumed verbatim by downstream SSE
 * visualisers and any rendering surface that wires onto the engine. Do
 * not widen or reshape without bumping a major.
 *
 * The runtime zod validator for the same shape lives in `events-schema.ts` so
 * consumers that don't need runtime validation (notably the in-browser
 * adapter) can tree-shake the `zod` dependency away.
 *
 */
export type ScanEvent =
  | { kind: 'scan_started'; scan_id: string; url: string; element_count: number }
  | {
      kind: 'element_scan';
      scan_id: string;
      seq: number;
      selector: string;
      bbox: { x: number; y: number; w: number; h: number };
      status: 'scanning' | 'passed' | 'violated';
      violations?: Array<{
        rule_id: string;
        severity: 'critical' | 'serious' | 'moderate' | 'minor';
        criterion: string;
        message: string;
      }>;
    }
  | {
      kind: 'scan_complete';
      scan_id: string;
      score: number;
      scorecard_slug?: string;
      counts: { critical: number; serious: number; moderate: number; minor: number };
      top_categories: Array<{ rule_id: string; count: number }>;
    }
  | { kind: 'scan_error'; scan_id: string; error: string };

/**
 *
 */
export type ScanEventListener = (event: ScanEvent) => void;
/**
 *
 */
export type Unsubscribe = () => void;

/**
 *
 */
export interface ScanEventEmitter {
  emit(event: ScanEvent): void;
  on(listener: ScanEventListener): Unsubscribe;
}

/**
 *
 */
export function createEventEmitter(): ScanEventEmitter {
  const listeners = new Set<ScanEventListener>();
  return {
    emit(event: ScanEvent): void {
      for (const l of listeners) l(event);
    },
    on(listener: ScanEventListener): Unsubscribe {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}
