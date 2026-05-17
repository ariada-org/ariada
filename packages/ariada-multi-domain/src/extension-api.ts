// SPDX-License-Identifier: EUPL-1.2
/**
 * Plugin-registry extension API.
 *
 * The registry is a small in-memory map; it owns no network or
 * filesystem state. Multiple registries can coexist in the same
 * process — each orchestrator instance owns its own registry by
 * default. Community implementers wishing to share a registry across
 * orchestrator instances pass an explicit registry into the
 * orchestrator constructor.
 *
 * Design notes:
 *
 *   - Registration is idempotent on the `(jurisdictionCode, rulePackVersion)`
 *     tuple. Re-registering a plugin with the same code AND the same
 *     rule pack version is a no-op; re-registering with a different
 *     rule pack version is an error (the caller has to call `replace`
 *     explicitly).
 *   - Registration never validates the plugin's behaviour, only its
 *     shape. Callers that wish to validate plugin output run their own
 *     contract tests via `validatePluginShape`.
 *   - The registry is a value, not a singleton. Tests and library
 *     consumers MAY construct as many registries as convenient.
 */

import type { JurisdictionPlugin } from './plugin.js';

/** Error class for registry-level usage errors. */
export class JurisdictionRegistryError extends Error {
  override readonly name = 'JurisdictionRegistryError';
  /**
   *
   */
  constructor(message: string) {
    super(message);
  }
}

/**
 * In-memory plugin registry. Plain class for ergonomic ESM usage; not
 * a singleton — callers construct their own.
 */
export class JurisdictionRegistry {
  readonly #plugins = new Map<string, JurisdictionPlugin>();

  /** Number of registered plugins. */
  get size(): number {
    return this.#plugins.size;
  }

  /** Iterate all registered plugins in registration order. */
  values(): IterableIterator<JurisdictionPlugin> {
    return this.#plugins.values();
  }

  /** Snapshot the registry as a plain array. */
  list(): JurisdictionPlugin[] {
    return [...this.#plugins.values()];
  }

  /** Look up a plugin by jurisdiction code. */
  get(code: string): JurisdictionPlugin | undefined {
    return this.#plugins.get(code);
  }

  /**
   * Register a plugin.
   *
   * @throws {JurisdictionRegistryError} when a plugin with the same
   *   `jurisdictionCode` is already registered with a different
   *   `rulePackVersion`. Use `replace()` to swap explicitly.
   */
  register(plugin: JurisdictionPlugin): void {
    validatePluginShape(plugin);
    const existing = this.#plugins.get(plugin.jurisdictionCode);
    if (existing) {
      if (existing.rulePackVersion === plugin.rulePackVersion) {
        // Idempotent.
        return;
      }
      throw new JurisdictionRegistryError(
        `jurisdiction "${plugin.jurisdictionCode}" already registered with rule pack ` +
          `${existing.rulePackId}@${existing.rulePackVersion}; ` +
          `refusing to silently overwrite with @${plugin.rulePackVersion}. ` +
          `Call replace() to swap explicitly.`,
      );
    }
    this.#plugins.set(plugin.jurisdictionCode, plugin);
  }

  /**
   * Replace an existing registration (or register if absent).
   *
   * Use this when intentionally swapping a plugin's rule pack version.
   */
  replace(plugin: JurisdictionPlugin): void {
    validatePluginShape(plugin);
    this.#plugins.set(plugin.jurisdictionCode, plugin);
  }

  /** Remove a plugin by code. Returns true if anything was removed. */
  unregister(code: string): boolean {
    return this.#plugins.delete(code);
  }

  /** Reset the registry. Mostly useful in tests. */
  clear(): void {
    this.#plugins.clear();
  }
}

/**
 * Validate that a value conforms to the `JurisdictionPlugin` shape.
 *
 * Validates structure only (presence + type of required fields). Does
 * NOT execute `emitJurisdictionSubset`.
 *
 * @throws {JurisdictionRegistryError} on any shape violation.
 */
export function validatePluginShape(plugin: unknown): asserts plugin is JurisdictionPlugin {
  if (plugin === null || typeof plugin !== 'object') {
    throw new JurisdictionRegistryError('plugin must be an object');
  }
  const p = plugin as Record<string, unknown>;
  const stringFields = [
    'jurisdictionCode',
    'jurisdictionLabel',
    'governingRegulation',
    'technicalStandard',
    'supervisoryAuthority',
    'rulePackId',
    'rulePackVersion',
  ] as const;
  for (const field of stringFields) {
    if (typeof p[field] !== 'string' || (p[field] as string).length === 0) {
      throw new JurisdictionRegistryError(`plugin.${field} must be a non-empty string`);
    }
  }
  const arrayFields = ['tldHints', 'metaHints', 'langAttrHints'] as const;
  for (const field of arrayFields) {
    if (!Array.isArray(p[field])) {
      throw new JurisdictionRegistryError(`plugin.${field} must be an array of strings`);
    }
    for (const item of p[field] as unknown[]) {
      if (typeof item !== 'string') {
        throw new JurisdictionRegistryError(`plugin.${field}[] must contain only strings`);
      }
    }
  }
  if (typeof p['emitJurisdictionSubset'] !== 'function') {
    throw new JurisdictionRegistryError('plugin.emitJurisdictionSubset must be a function');
  }
}
