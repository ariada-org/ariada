// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Domain, DomainAnalyzer } from './types.js';

/**
 * Rule / analyzer plugin registry. Each analyzer self-declares its domain +
 * rule ids; consumers look up by domain.
 */
export interface AnalyzerRegistry {
  register(a: DomainAnalyzer): void;
  get(domain: Domain): DomainAnalyzer | undefined;
  all(): DomainAnalyzer[];
}

/**
 *
 */
export function createRegistry(): AnalyzerRegistry {
  const byDomain = new Map<Domain, DomainAnalyzer>();
  return {
    register(a: DomainAnalyzer): void {
      byDomain.set(a.domain, a);
    },
    get(domain: Domain): DomainAnalyzer | undefined {
      return byDomain.get(domain);
    },
    all(): DomainAnalyzer[] {
      return [...byDomain.values()];
    },
  };
}

const defaultRegistry = createRegistry();

/**
 *
 */
export function registerAnalyzer(a: DomainAnalyzer): void {
  defaultRegistry.register(a);
}

/**
 *
 */
export function getDefaultRegistry(): AnalyzerRegistry {
  return defaultRegistry;
}
