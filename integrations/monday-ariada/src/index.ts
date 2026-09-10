// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// THE FINGERPRINT IS WHY THIS SYNCHRONISATION IS SAFE TO RUN TWICE. A board is
// not a database and has no unique constraint, so nothing on the far side stops
// a second run from filing every finding again. The identity of a finding is
// therefore computed here — the scanner's own fingerprint when it supplied one,
// otherwise a digest over the rule, the page and the selector — and every
// existing item's fingerprint is read back before anything is created.
//
// The two reasons for skipping are kept apart rather than merged into one count.
// "Already on the board" means an earlier run filed it; "repeated within this
// report" means the same finding appears twice in one scan. They look identical
// in a total and mean different things: the first is the synchronisation working,
// the second is worth knowing about the scan.
//
// THE REPORT IS READ DEFENSIVELY BECAUSE IT COMES FROM A FILE. A finding without
// a page address is dropped rather than filed against an empty string, an
// unrecognised severity becomes the middle one rather than being trusted, and
// the address is parsed and required to be http or https — this value ends up in
// an item name and a column, and a `javascript:` or `file:` address there is a
// link someone will eventually click.
//
// THE TOKEN IS REQUIRED AT CONSTRUCTION, not at the first request. A client
// built without one would fail on the first call, after the report was read and
// the run looked as though it had started.

import { createHash } from 'node:crypto';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AriadaFinding {
  ruleId: string;
  message: string;
  severity: Severity;
  pageUrl: string;
  selector?: string;
  wcagSc?: string[];
  fingerprint?: string;
  remediation?: string;
}

export interface AriadaReport {
  findings: AriadaFinding[];
  reportUrl?: string;
  scanId?: string;
}

export interface MondaySyncConfig {
  boardId: string;
  groupId?: string;
  fingerprintColumnId: string;
  severityColumnId?: string;
  ruleIdColumnId?: string;
  wcagColumnId?: string;
  selectorColumnId?: string;
  statusColumnId?: string;
  reportColumnId?: string;
}

export interface MondayItem {
  id: string;
  url?: string;
  fingerprint?: string;
}

export interface MondayClient {
  listItems(config: MondaySyncConfig): Promise<MondayItem[]>;
  createItem(input: {
    config: MondaySyncConfig;
    name: string;
    columnValues: Record<string, unknown>;
  }): Promise<MondayItem>;
}

export interface SyncResult {
  created: MondayItem[];
  skipped: Array<{ fingerprint: string; reason: 'existing' | 'duplicate-in-report' }>;
}

// Named optional fields rather than an index type, deliberately. An index type
// would be honest about how little is known, but under strict settings it forces
// bracket access everywhere, and the module that shipped reads these with a dot.
// The shape is the same; the emitted code is not.
interface RawReport {
  report?: unknown;
  findings?: unknown;
  reportUrl?: unknown;
  scanId?: unknown;
}

interface RawFinding {
  severity?: unknown;
  ruleId?: unknown;
  id?: unknown;
  pageUrl?: unknown;
  url?: unknown;
  message?: unknown;
  selector?: unknown;
  wcagSc?: unknown;
  fingerprint?: unknown;
  remediation?: unknown;
}

const severities: readonly string[] = ['minor', 'moderate', 'serious', 'critical'];

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function safeUrl(value: unknown, label: string): string {
  const url = new URL(requiredString(value, label));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use http(s)`);
  return url.toString();
}

export function parseAriadaReport(raw: unknown): AriadaReport {
  if (!raw || typeof raw !== 'object') throw new Error('Ariada report must be an object');
  const input = raw as RawReport;
  const report = (input.report && typeof input.report === 'object' ? input.report : input) as RawReport;
  const findings = report.findings;
  if (!Array.isArray(findings)) throw new Error('Ariada report findings must be an array');
  return {
    reportUrl: typeof report.reportUrl === 'string' ? report.reportUrl : undefined,
    scanId: typeof report.scanId === 'string' ? report.scanId : undefined,
    findings: findings.flatMap((value: unknown): AriadaFinding[] => {
      if (!value || typeof value !== 'object') return [];
      const item = value as RawFinding;
      const severity = (
        severities.includes(item.severity as string) ? item.severity : 'moderate'
      ) as Severity;
      const ruleId =
        typeof item.ruleId === 'string'
          ? item.ruleId
          : typeof item.id === 'string'
            ? item.id
            : 'unknown';
      const pageUrl =
        typeof item.pageUrl === 'string'
          ? item.pageUrl
          : typeof item.url === 'string'
            ? item.url
            : '';
      if (!pageUrl) return [];
      return [
        {
          ruleId,
          severity,
          pageUrl: safeUrl(pageUrl, 'finding pageUrl'),
          message: typeof item.message === 'string' ? item.message : ruleId,
          selector: typeof item.selector === 'string' ? item.selector : undefined,
          wcagSc: Array.isArray(item.wcagSc)
            ? item.wcagSc.filter((sc: unknown) => typeof sc === 'string')
            : undefined,
          fingerprint: typeof item.fingerprint === 'string' ? item.fingerprint : undefined,
          remediation: typeof item.remediation === 'string' ? item.remediation : undefined,
        },
      ];
    }),
  };
}

export function findingFingerprint(finding: AriadaFinding): string {
  if (finding.fingerprint?.trim()) return finding.fingerprint.trim();
  return createHash('sha256')
    .update([finding.ruleId, finding.pageUrl, finding.selector ?? ''].join('\n'))
    .digest('hex');
}

export function findingItemName(finding: AriadaFinding): string {
  return `${finding.ruleId} - ${new URL(finding.pageUrl).hostname}${new URL(finding.pageUrl).pathname}`;
}

export function findingColumnValues(
  finding: AriadaFinding,
  config: MondaySyncConfig,
  reportUrl?: string,
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    [config.fingerprintColumnId]: findingFingerprint(finding),
  };
  if (config.severityColumnId) values[config.severityColumnId] = { label: finding.severity };
  if (config.statusColumnId) values[config.statusColumnId] = { label: 'New' };
  if (config.ruleIdColumnId) values[config.ruleIdColumnId] = finding.ruleId;
  if (config.wcagColumnId) values[config.wcagColumnId] = (finding.wcagSc ?? []).join(', ');
  if (config.selectorColumnId) values[config.selectorColumnId] = finding.selector ?? '';
  if (config.reportColumnId && reportUrl)
    values[config.reportColumnId] = { url: reportUrl, text: 'Ariada report' };
  return values;
}

export async function syncReport(
  report: AriadaReport,
  client: MondayClient,
  config: MondaySyncConfig,
): Promise<SyncResult> {
  requiredString(config.boardId, 'boardId');
  requiredString(config.fingerprintColumnId, 'fingerprintColumnId');
  const existing = new Set(
    (await client.listItems(config))
      .map((item) => item.fingerprint)
      .filter((value): value is string => Boolean(value)),
  );
  const seen = new Set(existing);
  const result: SyncResult = { created: [], skipped: [] };
  for (const finding of report.findings) {
    const fingerprint = findingFingerprint(finding);
    if (seen.has(fingerprint)) {
      result.skipped.push({
        fingerprint,
        reason: existing.has(fingerprint) ? 'existing' : 'duplicate-in-report',
      });
      continue;
    }
    const item = await client.createItem({
      config,
      name: findingItemName(finding),
      columnValues: findingColumnValues(finding, config, report.reportUrl),
    });
    result.created.push(item);
    seen.add(fingerprint);
  }
  return result;
}

export function createMondayGraphqlClient(
  fetcher: typeof fetch = fetch,
  token: string = process.env.MONDAY_API_TOKEN ?? '',
): MondayClient {
  const apiToken = requiredString(token, 'MONDAY_API_TOKEN');

  async function request(query: string, variables: Record<string, unknown>): Promise<never> {
    const response = await fetcher('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        Authorization: apiToken,
        'Content-Type': 'application/json',
        'API-Version': '2025-10',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`monday GraphQL request failed (${response.status})`);
    const body = (await response.json()) as {
      errors?: { message?: string }[];
      data?: never;
    };
    if (body.errors?.length)
      throw new Error(
        `monday GraphQL error: ${body.errors.map((error) => error.message ?? 'unknown').join('; ')}`,
      );
    if (!body.data) throw new Error('monday GraphQL response did not contain data');
    return body.data;
  }

  return {
    async listItems(config) {
      const data: {
        boards: {
          items_page: {
            items: { id: string; url?: string; column_values: { text?: string }[] }[];
          };
        }[];
      } = await request(
        `query($boardId: ID!, $columnId: String!) { boards(ids: [$boardId]) { items_page(limit: 500) { items { id url column_values(ids: [$columnId]) { text } } } } }`,
        { boardId: config.boardId, columnId: config.fingerprintColumnId },
      );
      return (
        data.boards[0]?.items_page.items.map((item) => ({
          id: item.id,
          url: item.url,
          fingerprint: item.column_values[0]?.text,
        })) ?? []
      );
    },
    async createItem({ config, name, columnValues }) {
      const data: { create_item: MondayItem } = await request(
        `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String) { create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) { id name url } }`,
        {
          boardId: config.boardId,
          groupId: config.groupId,
          itemName: name,
          columnValues: JSON.stringify(columnValues),
        },
      );
      return data.create_item;
    },
  };
}
