// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { DomainModule } from '@ariada-org/core-engine';

import type { ModuleSource } from '../ui/report-grid.js';

/**
 * A domain module that has been loaded into the extension — either as a built-in
 * module (bundled at build time), a module installed via the companion CLI, or a
 * local file loaded in a sandboxed iframe.
 */
export interface LoadedModule {
  /** The module's unique identifier from its DomainModule.id field. */
  readonly id: string;
  /**
   * The actual DomainModule implementation. For sandboxed (local-file) modules
   * this field is null because the module code runs inside a sandboxed iframe;
   * its extractors are called indirectly via postMessage.
   */
  readonly module: DomainModule | null;
  /** Where the module came from — drives the source badge in the grid header. */
  readonly source: ModuleSource;
  /**
   * Whether the module runs in the extension's own context (trusted) or in a
   * sandboxed iframe (untrusted). Local-file modules loaded via the file picker
   * are always untrusted; companion-CLI and built-in modules are trusted.
   */
  readonly trusted: boolean;
  /** The human-readable name shown in the settings page and column header. */
  readonly displayName: string;
  /** The module's semver version string. */
  readonly version: string;
}

/**
 * A record the extension persists to chrome.storage.local so that modules
 * survive extension restarts. Built-in modules are not persisted — they are
 * always available and always registered at startup.
 */
export interface PersistedModule {
  readonly id: string;
  readonly source: 'companion-cli' | 'local-file';
  readonly trusted: boolean;
  readonly displayName: string;
  readonly version: string;
  /**
   * The raw JavaScript source of a local-file module, stored so it can be
   * re-instantiated in the sandbox iframe after an extension restart.
   * Only present when source === 'local-file'.
   */
  readonly localFileContent?: string;
}

/**
 * Central registry of all domain modules active in the current session.
 * Built-in modules are registered at startup; user-added modules (companion-CLI
 * or local-file sandbox) are registered dynamically and persisted.
 *
 * This class is intentionally free of any chrome.* API calls so it can be
 * unit-tested in a happy-dom environment without the extension runtime.
 */
export class ModuleRegistry {
  private readonly _modules: Map<string, LoadedModule> = new Map();

  /**
   * Register a loaded module. If a module with the same id is already present,
   * the new registration wins (the caller is responsible for deduplication).
   */
  register(loaded: LoadedModule): void {
    this._modules.set(loaded.id, loaded);
  }

  /**
   * Remove a module by id. Returns true if the module was present, false
   * otherwise.
   */
  unregister(id: string): boolean {
    return this._modules.delete(id);
  }

  /** Return all registered modules in insertion order. */
  getAll(): LoadedModule[] {
    return Array.from(this._modules.values());
  }

  /**
   * Return only trusted modules (built-in and companion-CLI). The single-pass
   * walker calls these modules' extractors directly during the DOM walk.
   */
  getTrusted(): LoadedModule[] {
    return this.getAll().filter((m) => m.trusted);
  }

  /**
   * Return only sandboxed (untrusted) modules loaded from a local file. The
   * content script drives these via the postMessage sandbox bridge rather than
   * calling their extractors directly.
   */
  getSandboxed(): LoadedModule[] {
    return this.getAll().filter((m) => !m.trusted);
  }

  /**
   * Return the DomainModule objects for all trusted modules that carry a real
   * DomainModule implementation. Sandboxed modules always have module === null
   * and are never included here.
   */
  getTrustedModules(): DomainModule[] {
    return this.getTrusted()
      .map((m) => m.module)
      .filter((m): m is DomainModule => m !== null);
  }

  /** Whether the registry contains a module with the given id. */
  has(id: string): boolean {
    return this._modules.has(id);
  }

  /** Number of currently registered modules. */
  get size(): number {
    return this._modules.size;
  }

  /**
   * Serialise user-added modules to a form suitable for chrome.storage.local.
   * Built-in modules are excluded because they are always reconstructed at
   * startup from the bundled code.
   */
  toPersistedModules(): PersistedModule[] {
    return this.getAll()
      .filter((m) => m.source !== 'built-in')
      .map((m) => ({
        id: m.id,
        source: m.source as 'companion-cli' | 'local-file',
        trusted: m.trusted,
        displayName: m.displayName,
        version: m.version,
      }));
  }
}
