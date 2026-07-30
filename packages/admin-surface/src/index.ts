// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export const ADMIN_SURFACE_SCHEMA = 'ariada-org.admin-surface/v1' as const;
export const HEX_RGB_WIRE_FORMAT = 'RRGGBB' as const;
export const SYSTEM_LOCALE_VALUE = 'system' as const;

export type HexRgb = string & { readonly __hexRgb: unique symbol };

export interface AdminContextualHelp {
  readonly summary: string;
  readonly defaultSemantics: string;
  readonly precedence: string;
  readonly effect: string;
}

interface AdminFieldBase {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
}

export interface AdminTextField extends AdminFieldBase {
  readonly kind: 'text' | 'nullable-text';
  readonly maxLength?: number;
}

export interface AdminNumberField extends AdminFieldBase {
  readonly kind: 'number' | 'integer';
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface AdminBooleanField extends AdminFieldBase {
  readonly kind: 'boolean';
}

export interface AdminSelectField extends AdminFieldBase {
  readonly kind: 'select';
  readonly options: readonly string[];
}

export interface AdminLocaleField extends AdminFieldBase {
  readonly kind: 'locale';
  readonly requiredCapability?: string;
  readonly allowSystem?: true;
}

export interface AdminColorField extends AdminFieldBase {
  readonly kind: 'color';
  readonly wireFormat: typeof HEX_RGB_WIRE_FORMAT;
}

export type AdminFieldDefinition =
  | AdminTextField
  | AdminNumberField
  | AdminBooleanField
  | AdminSelectField
  | AdminLocaleField
  | AdminColorField;

export interface AdminSemanticBlockDefinition {
  readonly id: string;
  readonly title: string;
  readonly helper: AdminContextualHelp;
}

export interface AdminFieldBlockDefinition extends AdminSemanticBlockDefinition {
  readonly fields: readonly AdminFieldDefinition[];
}

export interface AdminSurfaceDefinition {
  readonly schemaVersion: typeof ADMIN_SURFACE_SCHEMA;
  readonly id: string;
  readonly title: string;
  readonly localeRegistryId?: string;
  readonly blocks: readonly AdminFieldBlockDefinition[];
}

export interface LocaleOption {
  readonly kind: 'locale';
  readonly value: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly label: string;
  readonly capabilities: readonly string[];
}

export interface SystemLocaleOption {
  readonly kind: 'system';
  readonly value: typeof SYSTEM_LOCALE_VALUE;
  readonly label: 'Follow phone system';
}

export type LocaleSelectOption = LocaleOption | SystemLocaleOption;

export const SYSTEM_LOCALE_OPTION: SystemLocaleOption = Object.freeze({
  kind: 'system',
  value: SYSTEM_LOCALE_VALUE,
  label: 'Follow phone system',
});

export interface LocaleRegistry {
  readonly id: string;
  readonly productId: string;
  readonly options: readonly LocaleOption[];
}

interface LanguageSupportLike {
  readonly productId: string;
  readonly manifestId: string;
  readonly languages: readonly {
    readonly locale: string;
    readonly englishName: string;
    readonly nativeName: string;
    readonly enabled: boolean;
    readonly providers: readonly {
      readonly capabilities: readonly string[];
    }[];
  }[];
}

export interface AdminSurfaceIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export class AdminSurfaceValidationError extends Error {
  readonly code = 'ADMIN_SURFACE_VALIDATION_FAILED';
  readonly issues: readonly AdminSurfaceIssue[];

  constructor(issues: readonly AdminSurfaceIssue[]) {
    super('Admin surface validation failed');
    this.name = 'AdminSurfaceValidationError';
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

const ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const LOCALE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const CAPABILITY = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const HEX_RGB = /^[0-9A-F]{6}$/;
const SEMANTIC_LOCALE = /(?:^|[._:\s-])(locale|language)(?:$|[._:\s-])/i;
const SEMANTIC_COLOR = /(?:^|[._:\s-])(colou?r|hex|foreground|background)(?:$|[._:\s-])/i;
const FIELD_KINDS = new Set(['text', 'nullable-text', 'number', 'integer', 'boolean', 'select', 'locale', 'color']);

type MutableRecord = Record<string, unknown>;

export function defineAdminSurface<const T>(value: T): T & AdminSurfaceDefinition {
  const issues = validateAdminSurface(value);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & AdminSurfaceDefinition;
}

export function defineAdminSemanticBlocks<const T extends readonly unknown[]>(value: T): T & readonly AdminSemanticBlockDefinition[] {
  const issues: AdminSurfaceIssue[] = [];
  const ids = new Set<string>();
  value.forEach((candidate, index) => validateSemanticBlock(candidate, `$[${index}]`, ids, issues, false));
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & readonly AdminSemanticBlockDefinition[];
}

export function validateAdminSurface(value: unknown): readonly AdminSurfaceIssue[] {
  const issues: AdminSurfaceIssue[] = [];
  const root = record(value, '$', issues);
  if (!root) return freezeIssues(issues);
  if (root.schemaVersion !== ADMIN_SURFACE_SCHEMA) {
    add(issues, 'surface.schema.invalid', '$.schemaVersion', `Expected ${ADMIN_SURFACE_SCHEMA}.`);
  }
  token(root.id, ID, '$.id', 'surface.id.invalid', issues);
  text(root.title, '$.title', 'surface.title.invalid', issues);
  if (root.localeRegistryId !== undefined) {
    token(root.localeRegistryId, ID, '$.localeRegistryId', 'locale_registry.id.invalid', issues);
  }
  if (!Array.isArray(root.blocks) || root.blocks.length < 1) {
    add(issues, 'surface.blocks.invalid', '$.blocks', 'At least one semantic block is required.');
    return freezeIssues(issues);
  }
  const ids = new Set<string>();
  let hasLocale = false;
  root.blocks.forEach((candidate, index) => {
    const block = validateSemanticBlock(candidate, `$.blocks[${index}]`, ids, issues, true);
    if (!block || !Array.isArray(block.fields)) return;
    const keys = new Set<string>();
    block.fields.forEach((field, fieldIndex) => {
      const parsed = validateField(field, `$.blocks[${index}].fields[${fieldIndex}]`, keys, issues);
      if (parsed?.kind === 'locale') hasLocale = true;
    });
  });
  if (hasLocale && typeof root.localeRegistryId !== 'string') {
    add(issues, 'locale_registry.required', '$.localeRegistryId', 'A surface with locale fields requires one locale registry.');
  }
  return freezeIssues(issues);
}

export function createLocaleRegistryFromLanguageSupport(value: LanguageSupportLike): LocaleRegistry {
  const issues: AdminSurfaceIssue[] = [];
  const root = record(value, '$', issues);
  if (!root) throw new AdminSurfaceValidationError(issues);
  const productId = token(root.productId, ID, '$.productId', 'locale_registry.product.invalid', issues);
  const manifestId = token(root.manifestId, ID, '$.manifestId', 'locale_registry.id.invalid', issues);
  if (!Array.isArray(root.languages)) {
    add(issues, 'locale_registry.languages.invalid', '$.languages', 'Languages must be an array.');
  }
  const options: LocaleOption[] = [];
  const locales = new Set<string>();
  if (Array.isArray(root.languages)) root.languages.forEach((candidate, index) => {
    const language = record(candidate, `$.languages[${index}]`, issues);
    if (!language || language.enabled !== true) return;
    const locale = token(language.locale, LOCALE, `$.languages[${index}].locale`, 'locale.invalid', issues);
    const englishName = text(language.englishName, `$.languages[${index}].englishName`, 'locale.english_name.invalid', issues);
    const nativeName = text(language.nativeName, `$.languages[${index}].nativeName`, 'locale.native_name.invalid', issues);
    if (!locale || !englishName || !nativeName) return;
    if (locales.has(locale)) {
      add(issues, 'locale.duplicate', `$.languages[${index}].locale`, 'Enabled locale values must be unique.');
      return;
    }
    locales.add(locale);
    const capabilities = new Set<string>();
    if (!Array.isArray(language.providers)) {
      add(issues, 'locale.providers.invalid', `$.languages[${index}].providers`, 'Providers must be an array.');
      return;
    }
    for (const providerCandidate of language.providers) {
      const provider = record(providerCandidate, `$.languages[${index}].providers`, issues);
      if (!provider || !Array.isArray(provider.capabilities)) continue;
      for (const capability of provider.capabilities) {
        if (typeof capability === 'string' && CAPABILITY.test(capability)) capabilities.add(capability);
      }
    }
    options.push(Object.freeze({
      kind: 'locale',
      value: locale,
      englishName,
      nativeName,
      label: englishName === nativeName ? `${englishName} (${locale})` : `${englishName} — ${nativeName} (${locale})`,
      capabilities: Object.freeze([...capabilities].sort()),
    }));
  });
  if (options.length < 1) add(issues, 'locale_registry.empty', '$.languages', 'At least one enabled locale is required.');
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return Object.freeze({
    id: manifestId!,
    productId: productId!,
    options: Object.freeze(options),
  });
}

export function filterLocaleOptions(registry: LocaleRegistry, requiredCapability?: string): readonly LocaleOption[] {
  if (!requiredCapability) return registry.options;
  return Object.freeze(registry.options.filter(({ capabilities }) => capabilities.includes(requiredCapability)));
}

export function localeOptionsForField(
  registry: LocaleRegistry,
  field: Pick<AdminLocaleField, 'requiredCapability' | 'allowSystem'>,
): readonly LocaleSelectOption[] {
  const locales = filterLocaleOptions(registry, field.requiredCapability);
  return field.allowSystem === true
    ? Object.freeze([SYSTEM_LOCALE_OPTION, ...locales])
    : locales;
}

export function isLocaleAllowed(
  registry: LocaleRegistry,
  value: unknown,
  requiredCapability?: string,
  allowSystem = false,
): value is string {
  if (value === SYSTEM_LOCALE_VALUE) return allowSystem;
  return typeof value === 'string'
    && filterLocaleOptions(registry, requiredCapability).some((option) => option.value === value);
}

export function parseHexRgb(value: unknown): HexRgb {
  const normalized = typeof value === 'string' ? value.replace(/^#/, '').toUpperCase() : '';
  if (!HEX_RGB.test(normalized)) {
    throw new AdminSurfaceValidationError([{
      code: 'color.hex_rgb.invalid',
      path: '$',
      message: 'Expected exactly six hexadecimal digits, with an optional leading #.',
    }]);
  }
  return normalized as HexRgb;
}

export function isHexRgbWire(value: unknown): value is HexRgb {
  return typeof value === 'string' && HEX_RGB.test(value);
}

export function toColorInputValue(value: unknown): string {
  return `#${parseHexRgb(value).toLowerCase()}`;
}

export function fromColorInputValue(value: unknown): HexRgb {
  return parseHexRgb(value);
}

// ── Operator grid, metric column, row action and dashboard-profile contracts ──
// Framework-neutral (no React / AntD / AG Grid). A concrete UI — e.g.
// @ariada-org/admin-ui over AG Grid — renders these; the contract never carries a
// visual skin. See the FAP operator-dashboard design spec, sections 5.1 / 5.1a.

export const ADMIN_GRID_SCHEMA = 'ariada-org.admin-grid/v1' as const;
export const OPERATOR_DASHBOARD_PROFILE_SCHEMA = 'ariada-org.operator-dashboard-profile/v1' as const;

export type AdminMetricKind =
  | 'count' | 'ratio' | 'currency' | 'percent' | 'duration' | 'score' | 'text' | 'enum';
export type AdminColumnRenderer =
  | 'plain' | 'bar' | 'ramp' | 'sparkline' | 'tag' | 'status-dot';

export interface AdminColumnHelp {
  /** one-line "what is this column". */
  readonly description: string;
  /** how it is computed, e.g. "accepted / raws". */
  readonly formula?: string;
  /** wiki page slug (language is chosen by the renderer), e.g. "owed-ratio". */
  readonly wikiSlug?: string;
  /** anchor within the wiki page. */
  readonly wikiAnchor?: string;
}

export interface AdminMetricColumn {
  readonly key: string;
  readonly label: string;
  readonly kind: AdminMetricKind;
  readonly align?: 'left' | 'right' | 'center';
  readonly renderer?: AdminColumnRenderer;
  readonly colorRamp?: { readonly good: 'high' | 'low' };
  readonly pin?: 'left' | 'right';
  readonly width?: number;
  /** optional header helper: description + formula + wiki link */
  readonly help?: AdminColumnHelp;
}

export interface AdminRowAction {
  readonly key: string;
  readonly label: string;
  readonly danger?: boolean;
  readonly confirm: { readonly title?: string; readonly reasonRequired: boolean };
  /** guarded runtime path the UI posts to; never a raw DB write */
  readonly endpoint: string;
}

export interface AdminGridSurface {
  readonly schemaVersion: typeof ADMIN_GRID_SCHEMA;
  readonly id: string;
  readonly title: string;
  readonly rowKey: string;
  readonly columns: readonly AdminMetricColumn[];
  readonly rowActions?: readonly AdminRowAction[];
  readonly liveChannel?: string;
  readonly defaultSort?: { readonly key: string; readonly dir: 'asc' | 'desc' };
}

export interface OperatorDashboardProfile {
  readonly schemaVersion: typeof OPERATOR_DASHBOARD_PROFILE_SCHEMA;
  readonly id: string;
  readonly label: string;
  readonly landingPanel?: string;
  readonly panels?: readonly string[];
  /** subset + order of a grid's column keys */
  readonly columns: readonly string[];
  /** subset of a grid's row-action keys */
  readonly actions: readonly string[];
  readonly sort?: { readonly key: string; readonly dir: 'asc' | 'desc' };
  readonly terminology?: Readonly<Record<string, string>>;
  readonly density?: 'comfortable' | 'compact';
  /** the ONLY visual knob — a brand accent within the shared theme, not a skin */
  readonly accent?: string;
}

const METRIC_KINDS = new Set<string>(['count', 'ratio', 'currency', 'percent', 'duration', 'score', 'text', 'enum']);
const COLUMN_RENDERERS = new Set<string>(['plain', 'bar', 'ramp', 'sparkline', 'tag', 'status-dot']);
const ALIGNS = new Set<string>(['left', 'right', 'center']);
const PINS = new Set<string>(['left', 'right']);
const SORT_DIRS = new Set<string>(['asc', 'desc']);
const DENSITIES = new Set<string>(['comfortable', 'compact']);
// HARD INVARIANT (spec 5.1a): a profile changes content/functionality only — it
// may never carry a visual skin. These keys fail closed.
const FORBIDDEN_PROFILE_KEYS = new Set<string>(['css', 'class', 'classname', 'style', 'skin', 'stylesheet', 'theme']);

export function defineAdminGridSurface<const T>(value: T): T & AdminGridSurface {
  const issues = validateAdminGridSurface(value);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & AdminGridSurface;
}

export function defineOperatorDashboardProfile<const T>(value: T, grid?: AdminGridSurface): T & OperatorDashboardProfile {
  const issues = validateOperatorDashboardProfile(value, grid);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & OperatorDashboardProfile;
}

export function validateAdminGridSurface(value: unknown): readonly AdminSurfaceIssue[] {
  const issues: AdminSurfaceIssue[] = [];
  const root = record(value, '$', issues);
  if (!root) return freezeIssues(issues);
  if (root.schemaVersion !== ADMIN_GRID_SCHEMA) {
    add(issues, 'grid.schema.invalid', '$.schemaVersion', `Expected ${ADMIN_GRID_SCHEMA}.`);
  }
  token(root.id, ID, '$.id', 'grid.id.invalid', issues);
  text(root.title, '$.title', 'grid.title.invalid', issues);
  token(root.rowKey, FIELD_KEY, '$.rowKey', 'grid.rowKey.invalid', issues);
  const columnKeys = new Set<string>();
  if (!Array.isArray(root.columns) || root.columns.length < 1) {
    add(issues, 'grid.columns.invalid', '$.columns', 'At least one column is required.');
  } else {
    root.columns.forEach((candidate, index) => {
      const col = record(candidate, `$.columns[${index}]`, issues);
      if (!col) return;
      const key = token(col.key, FIELD_KEY, `$.columns[${index}].key`, 'grid.column.key.invalid', issues);
      text(col.label, `$.columns[${index}].label`, 'grid.column.label.invalid', issues);
      if (key && columnKeys.has(key)) add(issues, 'grid.column.key.duplicate', `$.columns[${index}].key`, 'Column keys must be unique.');
      if (key) columnKeys.add(key);
      if (typeof col.kind !== 'string' || !METRIC_KINDS.has(col.kind)) {
        add(issues, 'grid.column.kind.invalid', `$.columns[${index}].kind`, 'Unknown metric column kind.');
      }
      if (col.renderer !== undefined && (typeof col.renderer !== 'string' || !COLUMN_RENDERERS.has(col.renderer))) {
        add(issues, 'grid.column.renderer.invalid', `$.columns[${index}].renderer`, 'Unknown column renderer.');
      }
      if (col.align !== undefined && (typeof col.align !== 'string' || !ALIGNS.has(col.align))) {
        add(issues, 'grid.column.align.invalid', `$.columns[${index}].align`, 'Align must be left, right or center.');
      }
      if (col.pin !== undefined && (typeof col.pin !== 'string' || !PINS.has(col.pin))) {
        add(issues, 'grid.column.pin.invalid', `$.columns[${index}].pin`, 'Pin must be left or right.');
      }
      if (col.colorRamp !== undefined) {
        const ramp = record(col.colorRamp, `$.columns[${index}].colorRamp`, issues);
        if (ramp && ramp.good !== 'high' && ramp.good !== 'low') {
          add(issues, 'grid.column.ramp.invalid', `$.columns[${index}].colorRamp.good`, 'colorRamp.good must be high or low.');
        }
      }
      if (col.width !== undefined && (typeof col.width !== 'number' || !Number.isFinite(col.width) || col.width <= 0)) {
        add(issues, 'grid.column.width.invalid', `$.columns[${index}].width`, 'Width must be a positive number.');
      }
      if (col.help !== undefined) {
        const help = record(col.help, `$.columns[${index}].help`, issues);
        if (help) {
          text(help.description, `$.columns[${index}].help.description`, 'grid.column.help.description.invalid', issues);
          if (help.formula !== undefined && (typeof help.formula !== 'string' || help.formula.length < 1 || help.formula.length > 512)) {
            add(issues, 'grid.column.help.formula.invalid', `$.columns[${index}].help.formula`, 'formula must be a non-empty string.');
          }
          if (help.wikiSlug !== undefined) token(help.wikiSlug, ID, `$.columns[${index}].help.wikiSlug`, 'grid.column.help.wikiSlug.invalid', issues);
          if (help.wikiAnchor !== undefined) token(help.wikiAnchor, ID, `$.columns[${index}].help.wikiAnchor`, 'grid.column.help.wikiAnchor.invalid', issues);
        }
      }
    });
  }
  const actionKeys = new Set<string>();
  if (root.rowActions !== undefined) {
    if (!Array.isArray(root.rowActions)) {
      add(issues, 'grid.rowActions.invalid', '$.rowActions', 'rowActions must be an array.');
    } else {
      root.rowActions.forEach((candidate, index) => {
        const action = record(candidate, `$.rowActions[${index}]`, issues);
        if (!action) return;
        const key = token(action.key, FIELD_KEY, `$.rowActions[${index}].key`, 'grid.action.key.invalid', issues);
        text(action.label, `$.rowActions[${index}].label`, 'grid.action.label.invalid', issues);
        if (key && actionKeys.has(key)) add(issues, 'grid.action.key.duplicate', `$.rowActions[${index}].key`, 'Row-action keys must be unique.');
        if (key) actionKeys.add(key);
        const confirm = record(action.confirm, `$.rowActions[${index}].confirm`, issues);
        if (confirm && typeof confirm.reasonRequired !== 'boolean') {
          add(issues, 'grid.action.confirm.invalid', `$.rowActions[${index}].confirm.reasonRequired`, 'confirm.reasonRequired must be boolean.');
        }
        if (typeof action.endpoint !== 'string' || !action.endpoint.startsWith('/') || action.endpoint.startsWith('//')) {
          add(issues, 'grid.action.endpoint.invalid', `$.rowActions[${index}].endpoint`, 'endpoint must be a same-origin guarded-runtime path, never a raw write.');
        }
      });
    }
  }
  if (root.defaultSort !== undefined) {
    const sort = record(root.defaultSort, '$.defaultSort', issues);
    if (sort) {
      if (typeof sort.key !== 'string' || !columnKeys.has(sort.key)) {
        add(issues, 'grid.sort.key.invalid', '$.defaultSort.key', 'defaultSort.key must reference a declared column.');
      }
      if (typeof sort.dir !== 'string' || !SORT_DIRS.has(sort.dir)) {
        add(issues, 'grid.sort.dir.invalid', '$.defaultSort.dir', 'defaultSort.dir must be asc or desc.');
      }
    }
  }
  return freezeIssues(issues);
}

export function validateOperatorDashboardProfile(value: unknown, grid?: AdminGridSurface): readonly AdminSurfaceIssue[] {
  const issues: AdminSurfaceIssue[] = [];
  const root = record(value, '$', issues);
  if (!root) return freezeIssues(issues);
  if (root.schemaVersion !== OPERATOR_DASHBOARD_PROFILE_SCHEMA) {
    add(issues, 'profile.schema.invalid', '$.schemaVersion', `Expected ${OPERATOR_DASHBOARD_PROFILE_SCHEMA}.`);
  }
  token(root.id, ID, '$.id', 'profile.id.invalid', issues);
  text(root.label, '$.label', 'profile.label.invalid', issues);
  // HARD INVARIANT: a profile is content/functionality only — any visual-skin
  // key fails closed. Only `accent` (a brand colour within the shared theme) is
  // allowed.
  for (const key of Object.keys(root)) {
    if (FORBIDDEN_PROFILE_KEYS.has(key.toLowerCase())) {
      add(issues, 'profile.visual.forbidden', `$.${key}`, 'A dashboard profile may not carry a visual skin (css/class/style/skin/theme); only accent is allowed, within the shared theme.');
    }
  }
  const gridColumnKeys = grid ? new Set(grid.columns.map((c) => c.key)) : null;
  const gridActionKeys = grid ? new Set((grid.rowActions ?? []).map((a) => a.key)) : null;
  const profileColumns = new Set<string>();
  if (!Array.isArray(root.columns) || root.columns.length < 1) {
    add(issues, 'profile.columns.invalid', '$.columns', 'A profile must select at least one column.');
  } else {
    root.columns.forEach((key, index) => {
      if (typeof key !== 'string') { add(issues, 'profile.column.invalid', `$.columns[${index}]`, 'Column keys must be strings.'); return; }
      profileColumns.add(key);
      if (gridColumnKeys && !gridColumnKeys.has(key)) {
        add(issues, 'profile.column.unknown', `$.columns[${index}]`, `Column "${key}" is not declared by the grid.`);
      }
    });
  }
  if (root.actions !== undefined) {
    if (!Array.isArray(root.actions)) {
      add(issues, 'profile.actions.invalid', '$.actions', 'actions must be an array.');
    } else {
      root.actions.forEach((key, index) => {
        if (typeof key !== 'string') { add(issues, 'profile.action.invalid', `$.actions[${index}]`, 'Action keys must be strings.'); return; }
        if (gridActionKeys && !gridActionKeys.has(key)) {
          add(issues, 'profile.action.unknown', `$.actions[${index}]`, `Action "${key}" is not declared by the grid.`);
        }
      });
    }
  }
  if (root.sort !== undefined) {
    const sort = record(root.sort, '$.sort', issues);
    if (sort) {
      if (typeof sort.key !== 'string' || (profileColumns.size > 0 && !profileColumns.has(sort.key))) {
        add(issues, 'profile.sort.key.invalid', '$.sort.key', 'sort.key must be one of the profile columns.');
      }
      if (typeof sort.dir !== 'string' || !SORT_DIRS.has(sort.dir)) {
        add(issues, 'profile.sort.dir.invalid', '$.sort.dir', 'sort.dir must be asc or desc.');
      }
    }
  }
  if (root.density !== undefined && (typeof root.density !== 'string' || !DENSITIES.has(root.density))) {
    add(issues, 'profile.density.invalid', '$.density', 'density must be comfortable or compact.');
  }
  if (root.terminology !== undefined) {
    const term = record(root.terminology, '$.terminology', issues);
    if (term) {
      for (const [k, v] of Object.entries(term)) {
        if (typeof v !== 'string') add(issues, 'profile.terminology.invalid', `$.terminology.${k}`, 'Terminology overrides must be strings.');
      }
    }
  }
  return freezeIssues(issues);
}

// ── Chart contract (declarative, framework-neutral) ──────────────────────────
// A board declares an AdminChartSpec exactly the way it declares columns; the
// shared renderer draws it. TWO renderers read this ONE contract:
// @ariada-org/admin-ui (React, for Projectology) and @ariada-org/admin-svelte (Svelte,
// for KlarAds). The spec carries CONTENT only — series identity, categories,
// relationships. It may never carry a visual skin (css/class/style/theme), the
// same hard invariant the dashboard profile enforces.

export type AdminChartType = 'column' | 'line' | 'funnel' | 'graph';

/** a node in a relationship-map (`graph`) chart — e.g. one item of a комплект. */
export interface GraphNode {
  readonly id: string;
  readonly label?: string;
  /** optional grouping; the renderer maps a group to a palette slot. */
  readonly group?: string;
}

/** an edge (relationship) between two declared nodes. */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

/**
 * A board/surface-declared chart. `column` / `line` / `funnel` plot rows
 * (category on X, numeric series on Y); `graph` renders a relationship map from
 * nodes + edges. The contract is the stable seam: a light zero-dependency SVG
 * default renders it today, and a richer charting backend can swap in behind the
 * SAME spec for a consumer that opts into the heavy dependency — shared, not
 * forked.
 */
export interface AdminChartSpec {
  readonly type: AdminChartType;
  readonly title?: string;
  /** row key whose value labels each category (X axis). column/line/funnel. */
  readonly categoryKey?: string;
  /** row keys plotted as series (Y). Funnel uses the first key. column/line/funnel. */
  readonly valueKeys?: readonly string[];
  /** graph data (`type: 'graph'`) — the relationship map. */
  readonly nodes?: readonly GraphNode[];
  readonly edges?: readonly GraphEdge[];
  /** optional fixed colours per series/group; falls back to the renderer palette. */
  readonly colors?: readonly string[];
  /** cap categories (default 12) — keeps a dense board readable. */
  readonly maxCategories?: number;
  readonly height?: number;
  readonly unit?: string;
}

/** the category key a renderer falls back to when a spec omits `categoryKey`. */
export const ADMIN_CHART_DEFAULT_CATEGORY_KEY = 'name' as const;
/** the category cap a renderer falls back to when a spec omits `maxCategories`. */
export const ADMIN_CHART_DEFAULT_MAX_CATEGORIES = 12 as const;
/** the plot height a renderer falls back to when a spec omits `height`. */
export const ADMIN_CHART_DEFAULT_HEIGHT = 200 as const;

const CHART_TYPES = new Set<string>(['column', 'line', 'funnel', 'graph']);
const PLOT_CHART_TYPES = new Set<string>(['column', 'line', 'funnel']);
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
// Colours are DATA (series identity), so they are restricted to literal CSS hex.
// Anything else (a gradient, a url(), a var(), a class) would be a skin and is
// rejected — the same reason a profile may not carry a stylesheet.
const CSS_HEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const MAX_CHART_COLORS = 24;
const MAX_GRAPH_NODES = 512;
const MAX_GRAPH_EDGES = 2048;

export function defineAdminChartSpec<const T>(value: T): T & AdminChartSpec {
  const issues = validateAdminChartSpec(value);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & AdminChartSpec;
}

export function validateAdminChartSpec(value: unknown): readonly AdminSurfaceIssue[] {
  const issues: AdminSurfaceIssue[] = [];
  const root = record(value, '$', issues);
  if (!root) return freezeIssues(issues);

  // HARD INVARIANT (same as the dashboard profile): content only, never a skin.
  for (const key of Object.keys(root)) {
    if (FORBIDDEN_PROFILE_KEYS.has(key.toLowerCase())) {
      add(issues, 'chart.visual.forbidden', `$.${key}`, 'A chart spec may not carry a visual skin (css/class/style/skin/theme); only literal series colours are allowed.');
    }
  }

  const type = typeof root.type === 'string' && CHART_TYPES.has(root.type) ? root.type : undefined;
  if (!type) add(issues, 'chart.type.invalid', '$.type', 'type must be column, line, funnel or graph.');
  if (root.title !== undefined) text(root.title, '$.title', 'chart.title.invalid', issues);
  if (root.unit !== undefined) text(root.unit, '$.unit', 'chart.unit.invalid', issues);

  const isGraph = type === 'graph';
  const isPlot = type !== undefined && PLOT_CHART_TYPES.has(type);

  if (isPlot) {
    if (root.categoryKey !== undefined) {
      token(root.categoryKey, FIELD_KEY, '$.categoryKey', 'chart.categoryKey.invalid', issues);
    }
    if (!Array.isArray(root.valueKeys) || root.valueKeys.length < 1) {
      add(issues, 'chart.valueKeys.invalid', '$.valueKeys', 'A column/line/funnel chart must declare at least one value key.');
    } else {
      const seen = new Set<string>();
      root.valueKeys.forEach((key, index) => {
        const parsed = token(key, FIELD_KEY, `$.valueKeys[${index}]`, 'chart.valueKey.invalid', issues);
        if (!parsed) return;
        if (seen.has(parsed)) add(issues, 'chart.valueKey.duplicate', `$.valueKeys[${index}]`, 'Value keys must be unique.');
        seen.add(parsed);
      });
    }
    if (root.nodes !== undefined || root.edges !== undefined) {
      add(issues, 'chart.graph.forbidden', '$.nodes', 'nodes/edges belong to a graph chart only.');
    }
  }

  if (isGraph) {
    if (root.categoryKey !== undefined || root.valueKeys !== undefined) {
      add(issues, 'chart.series.forbidden', '$.valueKeys', 'categoryKey/valueKeys belong to a column, line or funnel chart only.');
    }
    const nodeIds = new Set<string>();
    if (!Array.isArray(root.nodes) || root.nodes.length < 1) {
      add(issues, 'chart.nodes.invalid', '$.nodes', 'A graph chart must declare at least one node.');
    } else if (root.nodes.length > MAX_GRAPH_NODES) {
      add(issues, 'chart.nodes.too_many', '$.nodes', `A graph chart may declare at most ${MAX_GRAPH_NODES} nodes.`);
    } else {
      root.nodes.forEach((candidate, index) => {
        const node = record(candidate, `$.nodes[${index}]`, issues);
        if (!node) return;
        const id = token(node.id, NODE_ID, `$.nodes[${index}].id`, 'chart.node.id.invalid', issues);
        if (id && nodeIds.has(id)) add(issues, 'chart.node.id.duplicate', `$.nodes[${index}].id`, 'Node ids must be unique.');
        if (id) nodeIds.add(id);
        if (node.label !== undefined) text(node.label, `$.nodes[${index}].label`, 'chart.node.label.invalid', issues);
        if (node.group !== undefined) text(node.group, `$.nodes[${index}].group`, 'chart.node.group.invalid', issues);
      });
    }
    if (root.edges !== undefined) {
      if (!Array.isArray(root.edges)) {
        add(issues, 'chart.edges.invalid', '$.edges', 'edges must be an array.');
      } else if (root.edges.length > MAX_GRAPH_EDGES) {
        add(issues, 'chart.edges.too_many', '$.edges', `A graph chart may declare at most ${MAX_GRAPH_EDGES} edges.`);
      } else {
        root.edges.forEach((candidate, index) => {
          const edge = record(candidate, `$.edges[${index}]`, issues);
          if (!edge) return;
          const from = token(edge.from, NODE_ID, `$.edges[${index}].from`, 'chart.edge.from.invalid', issues);
          const to = token(edge.to, NODE_ID, `$.edges[${index}].to`, 'chart.edge.to.invalid', issues);
          if (edge.label !== undefined) text(edge.label, `$.edges[${index}].label`, 'chart.edge.label.invalid', issues);
          if (nodeIds.size === 0) return;
          if (from && !nodeIds.has(from)) add(issues, 'chart.edge.unknown_node', `$.edges[${index}].from`, `Edge references undeclared node "${from}".`);
          if (to && !nodeIds.has(to)) add(issues, 'chart.edge.unknown_node', `$.edges[${index}].to`, `Edge references undeclared node "${to}".`);
        });
      }
    }
  }

  if (root.colors !== undefined) {
    if (!Array.isArray(root.colors) || root.colors.length < 1 || root.colors.length > MAX_CHART_COLORS) {
      add(issues, 'chart.colors.invalid', '$.colors', `colors must be an array of 1 to ${MAX_CHART_COLORS} literal CSS hex values.`);
    } else {
      root.colors.forEach((color, index) => {
        if (typeof color !== 'string' || !CSS_HEX.test(color)) {
          add(issues, 'chart.color.invalid', `$.colors[${index}]`, 'Expected a literal CSS hex colour such as #059669.');
        }
      });
    }
  }
  if (root.maxCategories !== undefined
    && (typeof root.maxCategories !== 'number' || !Number.isInteger(root.maxCategories) || root.maxCategories < 1 || root.maxCategories > 200)) {
    add(issues, 'chart.maxCategories.invalid', '$.maxCategories', 'maxCategories must be an integer between 1 and 200.');
  }
  if (root.height !== undefined
    && (typeof root.height !== 'number' || !Number.isFinite(root.height) || root.height <= 0 || root.height > 4096)) {
    add(issues, 'chart.height.invalid', '$.height', 'height must be a positive number of pixels.');
  }
  return freezeIssues(issues);
}

function validateSemanticBlock(
  candidate: unknown,
  path: string,
  ids: Set<string>,
  issues: AdminSurfaceIssue[],
  fieldsRequired: boolean,
): MutableRecord | undefined {
  const block = record(candidate, path, issues);
  if (!block) return undefined;
  const id = token(block.id, ID, `${path}.id`, 'block.id.invalid', issues);
  if (id && ids.has(id)) add(issues, 'block.id.duplicate', `${path}.id`, 'Block ids must be unique.');
  if (id) ids.add(id);
  text(block.title, `${path}.title`, 'block.title.invalid', issues);
  const helper = record(block.helper, `${path}.helper`, issues);
  if (helper) {
    for (const key of ['summary', 'defaultSemantics', 'precedence', 'effect'] as const) {
      text(helper[key], `${path}.helper.${key}`, `block.helper.${key}.invalid`, issues);
    }
  }
  if (fieldsRequired && (!Array.isArray(block.fields) || block.fields.length < 1)) {
    add(issues, 'block.fields.invalid', `${path}.fields`, 'A field block requires at least one field.');
  }
  return block;
}

function validateField(
  candidate: unknown,
  path: string,
  keys: Set<string>,
  issues: AdminSurfaceIssue[],
): MutableRecord | undefined {
  const field = record(candidate, path, issues);
  if (!field) return undefined;
  const key = token(field.key, FIELD_KEY, `${path}.key`, 'field.key.invalid', issues);
  const label = text(field.label, `${path}.label`, 'field.label.invalid', issues);
  if (key && keys.has(key)) add(issues, 'field.key.duplicate', `${path}.key`, 'Field keys must be unique within a block.');
  if (key) keys.add(key);
  if (typeof field.kind !== 'string' || !FIELD_KINDS.has(field.kind)) {
    add(issues, 'field.kind.invalid', `${path}.kind`, 'Unknown admin field kind.');
    return field;
  }
  const semantic = `${key ?? ''} ${label ?? ''}`;
  if ((field.kind === 'text' || field.kind === 'nullable-text') && SEMANTIC_LOCALE.test(semantic)) {
    add(issues, 'field.locale.text_forbidden', `${path}.kind`, 'Locale and language fields must use the shared locale kind.');
  }
  if ((field.kind === 'text' || field.kind === 'nullable-text') && SEMANTIC_COLOR.test(semantic)) {
    add(issues, 'field.color.text_forbidden', `${path}.kind`, 'Colour fields must use the shared color kind.');
  }
  if (field.kind === 'locale' && field.requiredCapability !== undefined) {
    token(field.requiredCapability, CAPABILITY, `${path}.requiredCapability`, 'field.locale.capability.invalid', issues);
  }
  if (field.kind !== 'locale' && field.allowSystem !== undefined) {
    add(issues, 'field.locale.system_forbidden', `${path}.allowSystem`, 'Only locale fields can allow the phone-system option.');
  }
  if (field.kind === 'color' && field.wireFormat !== HEX_RGB_WIRE_FORMAT) {
    add(issues, 'field.color.format.invalid', `${path}.wireFormat`, `Expected ${HEX_RGB_WIRE_FORMAT}.`);
  }
  if (field.kind === 'select' && (!Array.isArray(field.options) || field.options.length < 1
    || field.options.some((option) => typeof option !== 'string'))) {
    add(issues, 'field.select.options.invalid', `${path}.options`, 'Select fields require string options.');
  }
  return field;
}

function record(value: unknown, path: string, issues: AdminSurfaceIssue[]): MutableRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(issues, 'object.required', path, 'Expected an object.');
    return undefined;
  }
  return value as MutableRecord;
}

function token(
  value: unknown,
  pattern: RegExp,
  path: string,
  code: string,
  issues: AdminSurfaceIssue[],
): string | undefined {
  if (typeof value !== 'string' || !pattern.test(value)) {
    add(issues, code, path, 'Expected a canonical identifier.');
    return undefined;
  }
  return value;
}

function text(
  value: unknown,
  path: string,
  code: string,
  issues: AdminSurfaceIssue[],
): string | undefined {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > 512) {
    add(issues, code, path, 'Expected a non-empty trimmed string.');
    return undefined;
  }
  return value;
}

function add(issues: AdminSurfaceIssue[], code: string, path: string, message: string): void {
  issues.push(Object.freeze({ code, path, message }));
}

function freezeIssues(issues: AdminSurfaceIssue[]): readonly AdminSurfaceIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
