// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// The audit-management board — the heart of the Ariada admin, declared as DATA
// on the framework-neutral @ariada-org/admin-surface contract (rendered by
// @ariada-org/admin-svelte). One grid over a project's resources: every row is a
// scanned surface with its accessibility score, findings, Clamper gate state,
// and Reverter remediation state. Row actions drive the loop — run a scan, open
// the report, open the subject live in the Chrome plugin (before/after), or ask
// Reverter for a remediated version. No per-project code: a project just
// supplies rows; a profile re-orders columns/actions per audience.
import {
  defineAdminGridSurface,
  defineOperatorDashboardProfile,
} from '@ariada-org/admin-surface';

export const AUDITS_BOARD = defineAdminGridSurface({
  schemaVersion: 'ariada-org.admin-grid/v1',
  id: 'ariada.audits',
  title: 'Accessibility audits',
  rowKey: 'id',
  defaultSort: { key: 'score', dir: 'asc' }, // worst first
  columns: [
    { key: 'label', label: 'Resource', kind: 'text', pin: 'left', width: 260,
      help: { description: 'The scanned surface (a page in the project).', wikiSlug: 'audits', wikiAnchor: 'resource' } },
    { key: 'group', label: 'Group', kind: 'enum', renderer: 'tag',
      help: { description: 'core / bank / partner / grantee-module.', wikiSlug: 'audits', wikiAnchor: 'group' } },
    { key: 'score', label: 'Score', kind: 'score', align: 'right', renderer: 'ramp', colorRamp: { good: 'high' },
      help: { description: '1–10 accessibility score; critical defects dominate.', formula: 'see scoring model', wikiSlug: 'audits', wikiAnchor: 'score' } },
    { key: 'critical', label: 'Critical', kind: 'count', align: 'right', renderer: 'bar', colorRamp: { good: 'low' },
      help: { description: 'Defects that block a user completely.', wikiSlug: 'audits', wikiAnchor: 'critical' } },
    { key: 'serious', label: 'Serious', kind: 'count', align: 'right',
      help: { description: 'Defects that seriously degrade the experience.', wikiSlug: 'audits', wikiAnchor: 'serious' } },
    { key: 'findings', label: 'Findings', kind: 'count', align: 'right',
      help: { description: 'Total findings on this resource.', wikiSlug: 'audits', wikiAnchor: 'findings' } },
    { key: 'blastRadius', label: 'Blast radius', kind: 'count', align: 'right',
      help: { description: 'Pages amplified by one shared node (ACCE whole-codebase analysis).', wikiSlug: 'audits', wikiAnchor: 'blast-radius' } },
    { key: 'gate', label: 'Gate', kind: 'enum', renderer: 'status-dot',
      help: { description: 'Clamper CI gate — pass / blocked (new-vs-baseline).', wikiSlug: 'audits', wikiAnchor: 'gate' } },
    { key: 'reverter', label: 'Reverter', kind: 'enum', renderer: 'tag',
      help: { description: 'Remediation state — none / recommended / remediated.', wikiSlug: 'audits', wikiAnchor: 'reverter' } },
  ],
  rowActions: [
    { key: 'scan', label: 'Run scan', confirm: { reasonRequired: false }, endpoint: '/api/scan' },
    { key: 'report', label: 'Open report', confirm: { reasonRequired: false }, endpoint: '/api/report' },
    { key: 'plugin', label: 'Open live in plugin', confirm: { reasonRequired: false }, endpoint: '/api/plugin/open' },
    { key: 'remediate', label: 'Reverter remediate', confirm: { title: 'Generate a remediated version?', reasonRequired: false }, endpoint: '/api/reverter' },
  ],
} as const);

// Two profiles over the same grid — content/order only, never a skin.
export const AUDIT_PROFILES = [
  defineOperatorDashboardProfile(
    {
      schemaVersion: 'ariada-org.operator-dashboard-profile/v1',
      id: 'triage',
      label: 'Triage (worst first)',
      columns: ['label', 'group', 'score', 'critical', 'serious', 'blastRadius', 'gate', 'reverter'],
      actions: ['scan', 'report', 'plugin', 'remediate'],
      sort: { key: 'score', dir: 'asc' },
      density: 'comfortable',
    },
    AUDITS_BOARD,
  ),
  defineOperatorDashboardProfile(
    {
      schemaVersion: 'ariada-org.operator-dashboard-profile/v1',
      id: 'evidence',
      label: 'Evidence (procurement)',
      columns: ['label', 'group', 'score', 'findings', 'gate', 'reverter'],
      actions: ['report'],
      sort: { key: 'label', dir: 'asc' },
      density: 'compact',
    },
    AUDITS_BOARD,
  ),
] as const;
