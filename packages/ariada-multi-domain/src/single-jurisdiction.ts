// SPDX-License-Identifier: EUPL-1.2
/**
 * Single-jurisdiction reference orchestrator.
 *
 * The reference orchestrator dispatches one scan against exactly one
 * registered jurisdiction plugin and emits a `ScanEvent`. It exists so
 * community consumers can:
 *
 *   - exercise the published `ScanEvent` contract end-to-end without
 *     standing up production infrastructure;
 *   - validate their own `JurisdictionPlugin` implementations against
 *     a known-good reference;
 *   - serve as a working example for community-authored
 *     multi-jurisdiction orchestrators.
 *
 * Out of scope (deliberately):
 *
 *   - dispatching more than one jurisdiction in a single scan;
 *   - cross-jurisdiction conflict detection or resolution;
 *   - normalising findings that are tagged by several jurisdictions;
 *   - any optimisation that requires keeping cross-jurisdiction state.
 *
 * Callers that need multi-jurisdiction execution either implement
 * their own orchestrator on top of the `JurisdictionPlugin` contract
 * or subscribe to a hosted service that supplies that orchestration
 * behaviour.
 */

import type { JurisdictionRegistry } from './extension-api.js';
import type { JurisdictionPlugin } from './plugin.js';
import type { Finding, ScanEvent, ScanInput, SnapshotRef } from './types.js';

/**
 * Hook surface for callers that wish to drive the orchestrator with
 * their own snapshot capture + rule evaluation. The reference
 * orchestrator does not bind to any specific browser-automation
 * library — callers wire in a Playwright / Puppeteer / synthetic
 * provider that conforms to this interface.
 */
export interface SingleJurisdictionDeps {
  /** Capture a `SnapshotRef` for the given URL or pre-supplied HTML. */
  captureSnapshot(input: ScanInput): Promise<SnapshotRef> | SnapshotRef;
  /**
   * Run the rule pack referenced by `plugin.rulePackId` against the
   * captured snapshot, returning `Finding` records tagged with the
   * single registered `plugin.jurisdictionCode`.
   */
  evaluateRules(
    plugin: JurisdictionPlugin,
    snapshot: SnapshotRef,
  ): Promise<Finding[]> | Finding[];
  /** Return a fresh ULID. Pure-deterministic stubs are fine for tests. */
  newId(): string;
  /** Return the current wall-clock time. */
  now(): Date;
}

/**
 * Configuration passed to the orchestrator constructor.
 */
export interface SingleJurisdictionOrchestratorConfig {
  registry: JurisdictionRegistry;
  scannerVersion: string;
  ruleEngineVersion: string;
  deps: SingleJurisdictionDeps;
}

/**
 * Synchronous orchestrator entry point. Resolves to a fully-populated
 * `ScanEvent`.
 *
 * Failure modes:
 *
 *   - `ScanInput.jurisdictions` length !== 1 → throws synchronously.
 *   - `ScanInput.jurisdictions[0]` not registered → throws synchronously.
 *   - Snapshot capture / rule evaluation rejects → the promise rejects;
 *     the orchestrator deliberately does NOT swallow exceptions in the
 *     reference implementation. Callers wrap with their own retry
 *     logic if desired.
 */
export class SingleJurisdictionOrchestrator {
  readonly #config: SingleJurisdictionOrchestratorConfig;

  /**
   *
   */
  constructor(config: SingleJurisdictionOrchestratorConfig) {
    this.#config = config;
  }

  /**
   *
   */
  async scan(input: ScanInput): Promise<ScanEvent> {
    if (input.url === undefined && input.htmlSnapshot === undefined) {
      throw new Error('scan input must supply either `url` or `htmlSnapshot`');
    }

    if (!input.jurisdictions || input.jurisdictions.length !== 1) {
      throw new Error(
        'SingleJurisdictionOrchestrator accepts exactly one jurisdiction code; ' +
          'supply `jurisdictions: ["<code>"]`. Multi-jurisdiction execution is ' +
          'out of scope for the reference orchestrator.',
      );
    }

    const code = input.jurisdictions[0] as string;
    const plugin = this.#config.registry.get(code);
    if (!plugin) {
      throw new Error(
        `jurisdiction "${code}" is not registered; ` +
          `register the plugin via registry.register() first.`,
      );
    }

    const start = this.#config.deps.now();
    const snapshotStart = start.getTime();
    const snapshot = await this.#config.deps.captureSnapshot(input);
    const snapshotEnd = this.#config.deps.now().getTime();
    const snapshotMs = snapshotEnd - snapshotStart;

    const analyzerStart = snapshotEnd;
    const findings = await this.#config.deps.evaluateRules(plugin, snapshot);
    const analyzerEnd = this.#config.deps.now().getTime();
    const analyzerMs = analyzerEnd - analyzerStart;

    const url = input.url ?? '(htmlSnapshot)';
    const subset = plugin.emitJurisdictionSubset({
      url,
      effectiveUrl: url,
      snapshot,
      findings,
    });

    const end = this.#config.deps.now();
    const scanEvent: ScanEvent = {
      scanId: this.#config.deps.newId(),
      scanTimestamp: start.toISOString(),
      scanDurationMs: end.getTime() - start.getTime(),
      scannerVersion: this.#config.scannerVersion,
      ruleEngineVersion: this.#config.ruleEngineVersion,
      rulePackVersions: {
        [plugin.rulePackId]: plugin.rulePackVersion,
      },

      url,
      effectiveUrl: url,
      jurisdictionsRequested: [code],
      jurisdictionsDetected: [],
      jurisdictionsEffective: [code],

      snapshot,
      findings,
      perJurisdiction: {
        [code]: subset,
      },
      conflicts: [],
      performance: {
        snapshotMs,
        analyzersMs: {
          [code]: analyzerMs,
        },
        totalAnalyzersRun: 1,
        parallelism: 1,
      },
    };

    return scanEvent;
  }
}
