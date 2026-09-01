/**
 * Drizzle ORM schema for the salvage-migration Postgres database (v0.2.0).
 * Ported from the original SQLite/D1 schema.
 */
import {
  pgTable,
  text,
  integer,
  bigint,
  smallint,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

export const scans = pgTable(
  'scans',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull(),
    urlHost: text('url_host').notNull(),
    requestedAt: bigint('requested_at', { mode: 'number' }).notNull(),
    completedAt: bigint('completed_at', { mode: 'number' }),
    status: text('status', {
      enum: ['queued', 'running', 'complete', 'failed', 'timeout'],
    }).notNull(),
    ipHash: text('ip_hash').notNull(),
    turnstileOk: smallint('turnstile_ok').notNull().default(0),
    error: text('error'),
  },
  (t) => ({
    hostIdx: index('idx_scans_host').on(t.urlHost),
    reqIdx: index('idx_scans_req').on(t.requestedAt),
  }),
);

export const scorecards = pgTable(
  'scorecards',
  {
    slug: text('slug').primaryKey(),
    scanId: text('scan_id').notNull(),
    url: text('url').notNull(),
    score: integer('score').notNull(),
    criticalCount: integer('critical_count').notNull(),
    seriousCount: integer('serious_count').notNull(),
    moderateCount: integer('moderate_count').notNull(),
    minorCount: integer('minor_count').notNull(),
    topCategories: jsonb('top_categories').notNull(),
    screenshotKey: text('screenshot_key'),
    ogImageKey: text('og_image_key'),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    public: smallint('public').notNull().default(1),
    viewCount: integer('view_count').notNull().default(0),
    shareCount: integer('share_count').notNull().default(0),
    expiresAt: bigint('expires_at', { mode: 'number' }),
  },
  (t) => ({
    createdIdx: index('idx_scorecards_created').on(t.createdAt),
    expiresIdx: index('idx_scorecards_expires').on(t.expiresAt),
  }),
);

export const scanEvents = pgTable(
  'scan_events',
  {
    scanId: text('scan_id').notNull(),
    seq: integer('seq').notNull(),
    ts: bigint('ts', { mode: 'number' }).notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.scanId, t.seq] }),
  }),
);

export const scorecardCrossSells = pgTable(
  'scorecard_cross_sells',
  {
    scorecardSlug: text('scorecard_slug').notNull(),
    target: text('target', { enum: ['ariada', 'blamer', 'clamper', 'reverter'] }).notNull(),
    clicks: integer('clicks').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.scorecardSlug, t.target] }),
  }),
);

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    cookieId: text('cookie_id'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    path: text('path'),
    ref: text('ref'),
    at: bigint('at', { mode: 'number' }).notNull(),
  },
  (t) => ({
    cookieIdx: index('idx_events_cookie').on(t.cookieId),
    atIdx: index('idx_events_at').on(t.at),
  }),
);
