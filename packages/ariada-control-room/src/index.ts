// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// @ariada-org/control-room — pure view engine for the Control Room panel.
// Turns the raw Ariada control-room snapshot (bus/loop/cron/inventory/surfaces,
// written by the repo's own scripts/control-room-snapshot.mjs) into
// lamp-scored tiles a UI layer can render. No I/O here: the caller reads the
// snapshot file and passes the parsed JSON in — this package only derives a
// view from data it is given.
//
// Honesty invariant: missing or malformed data renders 'unknown', never a
// fabricated 'ok'. A tile's lamp is driven only by a real signal in the
// snapshot, never inferred from absence.

/**
 *
 */
export type LampStatus = 'ok' | 'warn' | 'fail' | 'unknown';

export const LAMP_STATUSES: readonly LampStatus[] = ['ok', 'warn', 'fail', 'unknown'];

export const LAMP_RANK: Record<LampStatus, number> = { ok: 0, unknown: 1, warn: 2, fail: 3 };

/** Worst (highest-ranked) lamp among a list — 'fail' beats 'warn' beats 'unknown' beats 'ok'. */
export function worstLamp(statuses: readonly LampStatus[]): LampStatus {
  let worst: LampStatus = 'ok';
  for (const status of statuses) {
    if (LAMP_RANK[status] > LAMP_RANK[worst]) worst = status;
  }
  return worst;
}

/**
 *
 */
export interface RawBusCatalog {
  packages?: number;
  publishEligible?: number;
  publishedNpm?: number;
  sourceOnly?: number;
  inSync?: boolean;
  drift?: number | string;
  error?: string;
}

/**
 *
 */
export interface RawBus {
  catalog?: RawBusCatalog;
  liveDeployDriftFacts?: number;
  liveDeployDrift?: unknown[];
}

/**
 *
 */
export interface RawSelfRegulatingLoop {
  factCount?: number;
  facts?: unknown[];
}

/**
 *
 */
export interface RawCronEntry {
  name: string;
  loaded: boolean;
  lastExit: string | null;
}

/**
 *
 */
export interface RawSurfaceEntry {
  name: string;
  present: boolean;
}

/**
 *
 */
export interface RawInventory {
  integrations?: number;
  packages?: number;
}

/** The shape written by scripts/control-room-snapshot.mjs. */
export interface ControlRoomSnapshot {
  generatedFromCommit?: string;
  branch?: string;
  lastCommit?: string;
  recentCommits?: string[];
  lastAuditRun?: string | null;
  bus?: RawBus;
  selfRegulatingLoop?: RawSelfRegulatingLoop;
  cron?: RawCronEntry[];
  inventory?: RawInventory;
  surfaces?: RawSurfaceEntry[];
}

/**
 *
 */
export interface BusTile {
  id: 'bus';
  status: LampStatus;
  packages: number | null;
  publishEligible: number | null;
  publishedNpm: number | null;
  sourceOnly: number | null;
  inSync: boolean | null;
  drift: number | null;
  detail?: string;
}

/**
 *
 */
export interface LoopTile {
  id: 'loop';
  status: LampStatus;
  factCount: number;
  liveDeployDriftFacts: number | null;
  recentFacts: unknown[];
}

/**
 *
 */
export interface CronTile {
  id: string;
  name: string;
  status: LampStatus;
  loaded: boolean;
  lastExit: string | null;
}

/**
 *
 */
export interface SurfaceTile {
  id: string;
  name: string;
  status: LampStatus;
  present: boolean;
}

/**
 *
 */
export interface InventoryTile {
  id: 'inventory';
  status: LampStatus;
  integrations: number;
  packages: number;
}

/**
 *
 */
export interface ControlRoomView {
  commit: string | null;
  branch: string | null;
  lastCommitMessage: string | null;
  recentCommits: string[];
  lastAuditRun: string | null;
  bus: BusTile;
  loop: LoopTile;
  cron: CronTile[];
  surfaces: SurfaceTile[];
  inventory: InventoryTile;
  overall: LampStatus;
}

function busTile(bus: RawBus | undefined): BusTile {
  const catalog = bus?.catalog;
  if (!catalog) {
    return {
      id: 'bus',
      status: 'unknown',
      packages: null,
      publishEligible: null,
      publishedNpm: null,
      sourceOnly: null,
      inSync: null,
      drift: null,
    };
  }
  if (catalog.error !== undefined) {
    return {
      id: 'bus',
      status: 'unknown',
      packages: null,
      publishEligible: null,
      publishedNpm: null,
      sourceOnly: null,
      inSync: null,
      drift: null,
      detail: catalog.error,
    };
  }
  if (typeof catalog.inSync !== 'boolean') {
    return {
      id: 'bus',
      status: 'unknown',
      packages: catalog.packages ?? null,
      publishEligible: catalog.publishEligible ?? null,
      publishedNpm: catalog.publishedNpm ?? null,
      sourceOnly: catalog.sourceOnly ?? null,
      inSync: null,
      drift: catalog.drift !== undefined ? Number(catalog.drift) : null,
    };
  }
  return {
    id: 'bus',
    status: catalog.inSync ? 'ok' : 'warn',
    packages: catalog.packages ?? null,
    publishEligible: catalog.publishEligible ?? null,
    publishedNpm: catalog.publishedNpm ?? null,
    sourceOnly: catalog.sourceOnly ?? null,
    inSync: catalog.inSync,
    drift: Number(catalog.drift ?? 0),
  };
}

/**
 * The self-regulating loop tile. `factCount` (Clamper→Blamer→Reverter facts
 * recorded — the anchoring loop's own three named checks) is informational
 * activity, not itself pass/fail. The lamp is driven ONLY by live-deploy-drift
 * facts — the loop catching a real repo-vs-deployed mismatch — green when zero.
 */
function loopTile(loop: RawSelfRegulatingLoop | undefined, bus: RawBus | undefined): LoopTile {
  const factCount = Number(loop?.factCount ?? 0);
  const recentFacts = Array.isArray(loop?.facts) ? loop.facts.slice(-10) : [];
  const driftFactsRaw = bus?.liveDeployDriftFacts;
  if (driftFactsRaw === undefined) {
    return { id: 'loop', status: 'unknown', factCount, liveDeployDriftFacts: null, recentFacts };
  }
  const liveDeployDriftFacts = Number(driftFactsRaw);
  return {
    id: 'loop',
    status: liveDeployDriftFacts > 0 ? 'fail' : 'ok',
    factCount,
    liveDeployDriftFacts,
    recentFacts,
  };
}

function cronTile(entry: RawCronEntry): CronTile {
  const name = entry.name || 'unknown';
  if (!entry.loaded) {
    return { id: `cron:${name}`, name, status: 'fail', loaded: false, lastExit: entry.lastExit ?? null };
  }
  const lastExit = entry.lastExit ?? null;
  const status: LampStatus = lastExit === '0' ? 'ok' : lastExit === null ? 'unknown' : 'warn';
  return { id: `cron:${name}`, name, status, loaded: true, lastExit };
}

function surfaceTile(entry: RawSurfaceEntry): SurfaceTile {
  const name = entry.name || 'unknown';
  const present = !!entry.present;
  // Roadmap gap, not an operational failure of what IS built — 'unknown', never 'fail'.
  return { id: `surface:${name}`, name, status: present ? 'ok' : 'unknown', present };
}

function inventoryTile(inventory: RawInventory | undefined): InventoryTile {
  const integrations = Number(inventory?.integrations ?? 0);
  const packages = Number(inventory?.packages ?? 0);
  // A pure count has no pass/fail threshold of its own — informational only.
  return { id: 'inventory', status: 'ok', integrations, packages };
}

/**
 * Derive the Control Room view from a parsed snapshot (or null/undefined if
 * none is available — every tile then honestly reports 'unknown').
 * `overall` is the worst lamp across bus / loop / cron — surfaces are
 * deliberately excluded (an absent product-surface build is a roadmap gap,
 * not an operational failure of what already ships) and inventory is a pure
 * count with no pass/fail threshold.
 */
export function deriveControlRoomView(snapshot: ControlRoomSnapshot | null | undefined): ControlRoomView {
  const s: ControlRoomSnapshot = snapshot ?? {};
  const bus = busTile(s.bus);
  const loop = loopTile(s.selfRegulatingLoop, s.bus);
  const cron = Array.isArray(s.cron) ? s.cron.map(cronTile) : [];
  const surfaces = Array.isArray(s.surfaces) ? s.surfaces.map(surfaceTile) : [];
  const inventory = inventoryTile(s.inventory);
  const overall = worstLamp([bus.status, loop.status, ...cron.map((c) => c.status)]);
  return {
    commit: s.generatedFromCommit ?? null,
    branch: s.branch ?? null,
    lastCommitMessage: s.lastCommit ?? null,
    recentCommits: Array.isArray(s.recentCommits) ? s.recentCommits : [],
    lastAuditRun: s.lastAuditRun ?? null,
    bus,
    loop,
    cron,
    surfaces,
    inventory,
    overall,
  };
}
