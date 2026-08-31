// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0

export const ADMIN_SURFACE_SCHEMA = 'ariada-org.admin-surface/v1' as const;
export const HEX_RGB_WIRE_FORMAT = 'RRGGBB' as const;
export const SYSTEM_LOCALE_VALUE = 'system' as const;

/** a colour string already checked to be `#rrggbb`; the brand keeps unchecked strings out. */
export type HexRgb = string & { readonly __hexRgb: unique symbol };

/** the helper a surface shows next to a field, and where it links for more. */
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

/** a free-text field. */
export interface AdminTextField extends AdminFieldBase {
  readonly kind: 'text' | 'nullable-text';
  readonly maxLength?: number;
}

/** a numeric field, with its own bounds and step. */
export interface AdminNumberField extends AdminFieldBase {
  readonly kind: 'number' | 'integer';
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** an on/off field. */
export interface AdminBooleanField extends AdminFieldBase {
  readonly kind: 'boolean';
}

/** a field whose value comes from a fixed list of options. */
export interface AdminSelectField extends AdminFieldBase {
  readonly kind: 'select';
  readonly options: readonly string[];
}

/** a field whose options are the locales the registry admits. */
export interface AdminLocaleField extends AdminFieldBase {
  readonly kind: 'locale';
  readonly requiredCapability?: string;
  readonly allowSystem?: true;
}

/** a colour field, carrying a checked `#rrggbb` value. */
export interface AdminColorField extends AdminFieldBase {
  readonly kind: 'color';
  readonly wireFormat: typeof HEX_RGB_WIRE_FORMAT;
}

/** any field a surface can declare. */
export type AdminFieldDefinition =
  | AdminTextField
  | AdminNumberField
  | AdminBooleanField
  | AdminSelectField
  | AdminLocaleField
  | AdminColorField;

/** a named region of a surface, in the order it is rendered. */
export interface AdminSemanticBlockDefinition {
  readonly id: string;
  readonly title: string;
  readonly helper: AdminContextualHelp;
}

/** a region that holds fields rather than free content. */
export interface AdminFieldBlockDefinition extends AdminSemanticBlockDefinition {
  readonly fields: readonly AdminFieldDefinition[];
}

/** a whole surface: its identity, its regions and the fields inside them. */
export interface AdminSurfaceDefinition {
  readonly schemaVersion: typeof ADMIN_SURFACE_SCHEMA;
  readonly id: string;
  readonly title: string;
  readonly localeRegistryId?: string;
  readonly blocks: readonly AdminFieldBlockDefinition[];
}

/** one locale a surface offers, with the names it is shown under. */
export interface LocaleOption {
  readonly kind: 'locale';
  readonly value: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly label: string;
  readonly capabilities: readonly string[];
}

/** the option that means "follow the system" rather than a named locale. */
export interface SystemLocaleOption {
  readonly kind: 'system';
  readonly value: typeof SYSTEM_LOCALE_VALUE;
  readonly label: 'Follow phone system';
}

/** anything a locale field can offer. */
export type LocaleSelectOption = LocaleOption | SystemLocaleOption;

export const SYSTEM_LOCALE_OPTION: SystemLocaleOption = Object.freeze({
  kind: 'system',
  value: SYSTEM_LOCALE_VALUE,
  label: 'Follow phone system',
});

/** the locales this deployment admits, and what each of them can do. */
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

/** one thing wrong with a definition: what, where, and in what terms. */
export interface AdminSurfaceIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

/** thrown when a definition cannot be used; carries every issue found, not the first. */
export class AdminSurfaceValidationError extends Error {
  readonly code = 'ADMIN_SURFACE_VALIDATION_FAILED';
  readonly issues: readonly AdminSurfaceIssue[];

  /**
   *
   */
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

/** validate a surface definition and hand it back with its type narrowed. */
export function defineAdminSurface<const T>(value: T): T & AdminSurfaceDefinition {
  const issues = validateAdminSurface(value);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & AdminSurfaceDefinition;
}

/** validate a list of regions and hand it back with its type narrowed. */
export function defineAdminSemanticBlocks<const T extends readonly unknown[]>(value: T): T & readonly AdminSemanticBlockDefinition[] {
  const issues: AdminSurfaceIssue[] = [];
  const ids = new Set<string>();
  for (const [index, candidate] of value.entries()) validateSemanticBlock(candidate, `$[${index}]`, ids, issues, false);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & readonly AdminSemanticBlockDefinition[];
}

/** every issue in a surface definition; empty when there is nothing wrong. */
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
  for (const [index, candidate] of root.blocks.entries()) {
    const block = validateSemanticBlock(candidate, `$.blocks[${index}]`, ids, issues, true);
    if (!block || !Array.isArray(block.fields)) continue;
    const keys = new Set<string>();
    for (const [fieldIndex, field] of block.fields.entries()) {
      const parsed = validateField(field, `$.blocks[${index}].fields[${fieldIndex}]`, keys, issues);
      if (parsed?.kind === 'locale') hasLocale = true;
    }
  }
  if (hasLocale && typeof root.localeRegistryId !== 'string') {
    add(issues, 'locale_registry.required', '$.localeRegistryId', 'A surface with locale fields requires one locale registry.');
  }
  return freezeIssues(issues);
}

/** build a locale registry from the deployment's language-support declaration. */
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
  if (Array.isArray(root.languages)) {
    for (const [index, candidate] of root.languages.entries()) {
      const option = readEnabledLocale(candidate, index, locales, issues);
      if (option) options.push(option);
    }
  }
  if (options.length < 1) add(issues, 'locale_registry.empty', '$.languages', 'At least one enabled locale is required.');
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return Object.freeze({
    id: manifestId!,
    productId: productId!,
    options: Object.freeze(options),
  });
}

/**
 * One enabled language of the support declaration, as the option a field will
 * offer — or nothing, when it is disabled, malformed or a locale already seen.
 * `seen` is added to, so the caller finds out about a repeat from the issues.
 */
function readEnabledLocale(
  candidate: unknown,
  index: number,
  seen: Set<string>,
  issues: AdminSurfaceIssue[],
): LocaleOption | undefined {
  const at = `$.languages[${index}]`;
  const language = record(candidate, at, issues);
  if (!language || language.enabled !== true) return undefined;

  const locale = token(language.locale, LOCALE, `${at}.locale`, 'locale.invalid', issues);
  const englishName = text(language.englishName, `${at}.englishName`, 'locale.english_name.invalid', issues);
  const nativeName = text(language.nativeName, `${at}.nativeName`, 'locale.native_name.invalid', issues);
  if (!locale || !englishName || !nativeName) return undefined;
  if (seen.has(locale)) {
    add(issues, 'locale.duplicate', `${at}.locale`, 'Enabled locale values must be unique.');
    return undefined;
  }
  seen.add(locale);

  if (!Array.isArray(language.providers)) {
    add(issues, 'locale.providers.invalid', `${at}.providers`, 'Providers must be an array.');
    return undefined;
  }
  const capabilities = collectCapabilities(language.providers, at, issues);

  return Object.freeze({
    kind: 'locale',
    value: locale,
    englishName,
    nativeName,
    label: englishName === nativeName ? `${englishName} (${locale})` : `${englishName} — ${nativeName} (${locale})`,
    capabilities: Object.freeze([...capabilities].sort((a, b) => a.localeCompare(b))),
  }) as LocaleOption;
}

/** every capability the providers of one language between them offer. */
function collectCapabilities(providers: readonly unknown[], at: string, issues: AdminSurfaceIssue[]): Set<string> {
  const capabilities = new Set<string>();
  for (const providerCandidate of providers) {
    const provider = record(providerCandidate, `${at}.providers`, issues);
    if (!provider || !Array.isArray(provider.capabilities)) continue;
    for (const capability of provider.capabilities) {
      if (typeof capability === 'string' && CAPABILITY.test(capability)) capabilities.add(capability);
    }
  }
  return capabilities;
}

/** the locales that can do what is asked of them; all of them when nothing is asked. */
export function filterLocaleOptions(registry: LocaleRegistry, requiredCapability?: string): readonly LocaleOption[] {
  if (!requiredCapability) return registry.options;
  return Object.freeze(registry.options.filter(({ capabilities }) => capabilities.includes(requiredCapability)));
}

/** the options a locale field shows, with "follow the system" first when it allows it. */
export function localeOptionsForField(
  registry: LocaleRegistry,
  field: Pick<AdminLocaleField, 'requiredCapability' | 'allowSystem'>,
): readonly LocaleSelectOption[] {
  const locales = filterLocaleOptions(registry, field.requiredCapability);
  return field.allowSystem === true
    ? Object.freeze([SYSTEM_LOCALE_OPTION, ...locales])
    : locales;
}

/** whether a locale may be chosen for this field, capability and all. */
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

/** read a `#rrggbb` colour, throwing when the value is not one. */
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

/** whether a value is a `#rrggbb` colour as it travels over the wire. */
export function isHexRgbWire(value: unknown): value is HexRgb {
  return typeof value === 'string' && HEX_RGB.test(value);
}

/** the value a colour input expects, for a colour that may not be set. */
export function toColorInputValue(value: unknown): string {
  return `#${parseHexRgb(value).toLowerCase()}`;
}

/** the checked colour behind what a colour input handed back. */
export function fromColorInputValue(value: unknown): HexRgb {
  return parseHexRgb(value);
}

// ── Operator grid, metric column, row action and dashboard-profile contracts ──
// Framework-neutral (no React / AntD / AG Grid). A concrete UI — e.g.
// @ariada-org/admin-ui over AG Grid — renders these; the contract never carries a
// visual skin. See the FAP operator-dashboard design spec, sections 5.1 / 5.1a.

export const ADMIN_GRID_SCHEMA = 'ariada-org.admin-grid/v1' as const;
export const OPERATOR_DASHBOARD_PROFILE_SCHEMA = 'ariada-org.operator-dashboard-profile/v1' as const;

/** what a column's numbers mean, which decides how they are written. */
export type AdminMetricKind =
  | 'count' | 'ratio' | 'currency' | 'percent' | 'duration' | 'score' | 'text' | 'enum';
/** how a column is drawn, beyond writing its value out. */
export type AdminColumnRenderer =
  | 'plain' | 'bar' | 'ramp' | 'sparkline' | 'tag' | 'status-dot';

/** the helper shown against a column heading, and where it links. */
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

/** one column of an operator grid: what it reads, means, and looks like. */
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

/** an action offered on a row, and what it needs before it fires. */
export interface AdminRowAction {
  readonly key: string;
  readonly label: string;
  readonly danger?: boolean;
  readonly confirm: { readonly title?: string; readonly reasonRequired: boolean };
  /** guarded runtime path the UI posts to; never a raw DB write */
  readonly endpoint: string;
}

/** an operator grid: its columns, its row actions and how it is keyed. */
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

/** what one operator board shows, drawn from a grid surface. */
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

/** validate a grid surface and hand it back with its type narrowed. */
export function defineAdminGridSurface<const T>(value: T): T & AdminGridSurface {
  const issues = validateAdminGridSurface(value);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & AdminGridSurface;
}

/** validate a board profile against its grid and hand it back with its type narrowed. */
export function defineOperatorDashboardProfile<const T>(value: T, grid?: AdminGridSurface): T & OperatorDashboardProfile {
  const issues = validateOperatorDashboardProfile(value, grid);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & OperatorDashboardProfile;
}

/** every issue in a grid surface; empty when there is nothing wrong. */
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

  const columnKeys = validateGridColumns(root, issues);
  validateGridRowActions(root, issues);
  validateGridDefaultSort(root, columnKeys, issues);

  return freezeIssues(issues);
}

/** the declared columns; returns the keys the default sort is checked against. */
function validateGridColumns(root: MutableRecord, issues: AdminSurfaceIssue[]): Set<string> {
  const columnKeys = new Set<string>();
  if (!Array.isArray(root.columns) || root.columns.length < 1) {
    add(issues, 'grid.columns.invalid', '$.columns', 'At least one column is required.');
    return columnKeys;
  }
  for (const [index, candidate] of root.columns.entries()) {
    const col = record(candidate, `$.columns[${index}]`, issues);
    if (!col) continue;
    const at = `$.columns[${index}]`;
    const key = token(col.key, FIELD_KEY, `${at}.key`, 'grid.column.key.invalid', issues);
    text(col.label, `${at}.label`, 'grid.column.label.invalid', issues);
    if (key && columnKeys.has(key)) add(issues, 'grid.column.key.duplicate', `${at}.key`, 'Column keys must be unique.');
    if (key) columnKeys.add(key);
    validateColumnVocabulary(col, at, issues);
    validateColumnRamp(col, at, issues);
    validateColumnHelp(col, at, issues);
  }
  return columnKeys;
}

/** the fields of a column that must come from a known set. */
function validateColumnVocabulary(col: MutableRecord, at: string, issues: AdminSurfaceIssue[]): void {
  if (typeof col.kind !== 'string' || !METRIC_KINDS.has(col.kind)) {
    add(issues, 'grid.column.kind.invalid', `${at}.kind`, 'Unknown metric column kind.');
  }
  if (col.renderer !== undefined && (typeof col.renderer !== 'string' || !COLUMN_RENDERERS.has(col.renderer))) {
    add(issues, 'grid.column.renderer.invalid', `${at}.renderer`, 'Unknown column renderer.');
  }
  if (col.align !== undefined && (typeof col.align !== 'string' || !ALIGNS.has(col.align))) {
    add(issues, 'grid.column.align.invalid', `${at}.align`, 'Align must be left, right or center.');
  }
  if (col.pin !== undefined && (typeof col.pin !== 'string' || !PINS.has(col.pin))) {
    add(issues, 'grid.column.pin.invalid', `${at}.pin`, 'Pin must be left or right.');
  }
  if (col.width !== undefined && (typeof col.width !== 'number' || !Number.isFinite(col.width) || col.width <= 0)) {
    add(issues, 'grid.column.width.invalid', `${at}.width`, 'Width must be a positive number.');
  }
}

/** the colour ramp a column may carry, and which end of it is good. */
function validateColumnRamp(col: MutableRecord, at: string, issues: AdminSurfaceIssue[]): void {
  if (col.colorRamp === undefined) return;
  const ramp = record(col.colorRamp, `${at}.colorRamp`, issues);
  if (ramp && ramp.good !== 'high' && ramp.good !== 'low') {
    add(issues, 'grid.column.ramp.invalid', `${at}.colorRamp.good`, 'colorRamp.good must be high or low.');
  }
}

/** the helper text a column may carry, and where it points. */
function validateColumnHelp(col: MutableRecord, at: string, issues: AdminSurfaceIssue[]): void {
  if (col.help === undefined) return;
  const help = record(col.help, `${at}.help`, issues);
  if (!help) return;
  text(help.description, `${at}.help.description`, 'grid.column.help.description.invalid', issues);
  if (help.formula !== undefined && (typeof help.formula !== 'string' || help.formula.length < 1 || help.formula.length > 512)) {
    add(issues, 'grid.column.help.formula.invalid', `${at}.help.formula`, 'formula must be a non-empty string.');
  }
  if (help.wikiSlug !== undefined) token(help.wikiSlug, ID, `${at}.help.wikiSlug`, 'grid.column.help.wikiSlug.invalid', issues);
  if (help.wikiAnchor !== undefined) token(help.wikiAnchor, ID, `${at}.help.wikiAnchor`, 'grid.column.help.wikiAnchor.invalid', issues);
}

/** the actions offered on a row, including where each of them writes. */
function validateGridRowActions(root: MutableRecord, issues: AdminSurfaceIssue[]): void {
  if (root.rowActions === undefined) return;
  if (!Array.isArray(root.rowActions)) {
    add(issues, 'grid.rowActions.invalid', '$.rowActions', 'rowActions must be an array.');
    return;
  }
  const actionKeys = new Set<string>();
  for (const [index, candidate] of root.rowActions.entries()) {
    const action = record(candidate, `$.rowActions[${index}]`, issues);
    if (!action) continue;
    const at = `$.rowActions[${index}]`;
    const key = token(action.key, FIELD_KEY, `${at}.key`, 'grid.action.key.invalid', issues);
    text(action.label, `${at}.label`, 'grid.action.label.invalid', issues);
    if (key && actionKeys.has(key)) add(issues, 'grid.action.key.duplicate', `${at}.key`, 'Row-action keys must be unique.');
    if (key) actionKeys.add(key);
    const confirm = record(action.confirm, `${at}.confirm`, issues);
    if (confirm && typeof confirm.reasonRequired !== 'boolean') {
      add(issues, 'grid.action.confirm.invalid', `${at}.confirm.reasonRequired`, 'confirm.reasonRequired must be boolean.');
    }
    if (typeof action.endpoint !== 'string' || !action.endpoint.startsWith('/') || action.endpoint.startsWith('//')) {
      add(issues, 'grid.action.endpoint.invalid', `${at}.endpoint`, 'endpoint must be a same-origin guarded-runtime path, never a raw write.');
    }
  }
}

/** the sort a grid opens on, which has to name a column it declared. */
function validateGridDefaultSort(root: MutableRecord, columnKeys: ReadonlySet<string>, issues: AdminSurfaceIssue[]): void {
  if (root.defaultSort === undefined) return;
  const sort = record(root.defaultSort, '$.defaultSort', issues);
  if (!sort) return;
  if (typeof sort.key !== 'string' || !columnKeys.has(sort.key)) {
    add(issues, 'grid.sort.key.invalid', '$.defaultSort.key', 'defaultSort.key must reference a declared column.');
  }
  if (typeof sort.dir !== 'string' || !SORT_DIRS.has(sort.dir)) {
    add(issues, 'grid.sort.dir.invalid', '$.defaultSort.dir', 'defaultSort.dir must be asc or desc.');
  }
}


/** every issue in a board profile, including where it disagrees with its grid. */
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

  const profileColumns = validateProfileColumns(root, grid, issues);
  validateProfileActions(root, grid, issues);
  validateProfileSort(root, profileColumns, issues);
  validateProfilePresentation(root, issues);

  return freezeIssues(issues);
}

/** the columns a profile selects; returns them for the sort to be checked against. */
function validateProfileColumns(root: MutableRecord, grid: AdminGridSurface | undefined, issues: AdminSurfaceIssue[]): Set<string> {
  const declared = grid ? new Set(grid.columns.map((c) => c.key)) : null;
  const selected = new Set<string>();
  if (!Array.isArray(root.columns) || root.columns.length < 1) {
    add(issues, 'profile.columns.invalid', '$.columns', 'A profile must select at least one column.');
    return selected;
  }
  for (const [index, key] of root.columns.entries()) {
    if (typeof key !== 'string') {
      add(issues, 'profile.column.invalid', `$.columns[${index}]`, 'Column keys must be strings.');
      continue;
    }
    selected.add(key);
    if (declared && !declared.has(key)) {
      add(issues, 'profile.column.unknown', `$.columns[${index}]`, `Column "${key}" is not declared by the grid.`);
    }
  }
  return selected;
}

/** the row actions a profile offers, each of which the grid has to declare. */
function validateProfileActions(root: MutableRecord, grid: AdminGridSurface | undefined, issues: AdminSurfaceIssue[]): void {
  if (root.actions === undefined) return;
  if (!Array.isArray(root.actions)) {
    add(issues, 'profile.actions.invalid', '$.actions', 'actions must be an array.');
    return;
  }
  const declared = grid ? new Set((grid.rowActions ?? []).map((a) => a.key)) : null;
  for (const [index, key] of root.actions.entries()) {
    if (typeof key !== 'string') {
      add(issues, 'profile.action.invalid', `$.actions[${index}]`, 'Action keys must be strings.');
      continue;
    }
    if (declared && !declared.has(key)) {
      add(issues, 'profile.action.unknown', `$.actions[${index}]`, `Action "${key}" is not declared by the grid.`);
    }
  }
}

/** the sort a profile opens on, which has to be one of the columns it selected. */
function validateProfileSort(root: MutableRecord, selected: ReadonlySet<string>, issues: AdminSurfaceIssue[]): void {
  if (root.sort === undefined) return;
  const sort = record(root.sort, '$.sort', issues);
  if (!sort) return;
  if (typeof sort.key !== 'string' || (selected.size > 0 && !selected.has(sort.key))) {
    add(issues, 'profile.sort.key.invalid', '$.sort.key', 'sort.key must be one of the profile columns.');
  }
  if (typeof sort.dir !== 'string' || !SORT_DIRS.has(sort.dir)) {
    add(issues, 'profile.sort.dir.invalid', '$.sort.dir', 'sort.dir must be asc or desc.');
  }
}

/** how densely a profile is drawn and what it calls things. */
function validateProfilePresentation(root: MutableRecord, issues: AdminSurfaceIssue[]): void {
  if (root.density !== undefined && (typeof root.density !== 'string' || !DENSITIES.has(root.density))) {
    add(issues, 'profile.density.invalid', '$.density', 'density must be comfortable or compact.');
  }
  if (root.terminology === undefined) return;
  const term = record(root.terminology, '$.terminology', issues);
  if (!term) return;
  for (const [key, value] of Object.entries(term)) {
    if (typeof value !== 'string') {
      add(issues, 'profile.terminology.invalid', `$.terminology.${key}`, 'Terminology overrides must be strings.');
    }
  }
}


// ── Chart contract (declarative, framework-neutral) ──────────────────────────
// A board declares an AdminChartSpec exactly the way it declares columns; the
// shared renderer draws it. TWO renderers read this ONE contract:
// @ariada-org/admin-ui (React, for Projectology) and @ariada-org/admin-svelte (Svelte,
// for KlarAds). The spec carries CONTENT only — series identity, categories,
// relationships. It may never carry a visual skin (css/class/style/theme), the
// same hard invariant the dashboard profile enforces.

/** the shapes a chart can take. */
export type AdminChartType = 'column' | 'line' | 'funnel' | 'graph';

/** a node in a relationship-map (`graph`) chart — e.g. one item of a set. */
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

/** validate a chart specification and hand it back with its type narrowed. */
export function defineAdminChartSpec<const T>(value: T): T & AdminChartSpec {
  const issues = validateAdminChartSpec(value);
  if (issues.length > 0) throw new AdminSurfaceValidationError(issues);
  return deepFreeze(structuredClone(value)) as T & AdminChartSpec;
}

/** every issue in a chart specification; empty when there is nothing wrong. */
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

  if (type !== undefined && PLOT_CHART_TYPES.has(type)) validatePlotSeries(root, issues);
  if (type === 'graph') validateGraphChart(root, issues);
  validateChartColors(root, issues);
  validateChartBounds(root, issues);

  return freezeIssues(issues);
}

/** the category and value keys a column, line or funnel chart plots. */
function validatePlotSeries(root: MutableRecord, issues: AdminSurfaceIssue[]): void {
  if (root.categoryKey !== undefined) {
    token(root.categoryKey, FIELD_KEY, '$.categoryKey', 'chart.categoryKey.invalid', issues);
  }
  if (!Array.isArray(root.valueKeys) || root.valueKeys.length < 1) {
    add(issues, 'chart.valueKeys.invalid', '$.valueKeys', 'A column/line/funnel chart must declare at least one value key.');
  } else {
    const seen = new Set<string>();
    for (const [index, key] of root.valueKeys.entries()) {
      const parsed = token(key, FIELD_KEY, `$.valueKeys[${index}]`, 'chart.valueKey.invalid', issues);
      if (!parsed) continue;
      if (seen.has(parsed)) add(issues, 'chart.valueKey.duplicate', `$.valueKeys[${index}]`, 'Value keys must be unique.');
      seen.add(parsed);
    }
  }
  if (root.nodes !== undefined || root.edges !== undefined) {
    add(issues, 'chart.graph.forbidden', '$.nodes', 'nodes/edges belong to a graph chart only.');
  }
}

/** the nodes and edges of a graph chart, and the keys it must not carry. */
function validateGraphChart(root: MutableRecord, issues: AdminSurfaceIssue[]): void {
  if (root.categoryKey !== undefined || root.valueKeys !== undefined) {
    add(issues, 'chart.series.forbidden', '$.valueKeys', 'categoryKey/valueKeys belong to a column, line or funnel chart only.');
  }
  const nodeIds = validateGraphNodes(root, issues);
  validateGraphEdges(root, nodeIds, issues);
}

/** the declared nodes; returns the ids the edges are then checked against. */
function validateGraphNodes(root: MutableRecord, issues: AdminSurfaceIssue[]): Set<string> {
  const nodeIds = new Set<string>();
  if (!Array.isArray(root.nodes) || root.nodes.length < 1) {
    add(issues, 'chart.nodes.invalid', '$.nodes', 'A graph chart must declare at least one node.');
    return nodeIds;
  }
  if (root.nodes.length > MAX_GRAPH_NODES) {
    add(issues, 'chart.nodes.too_many', '$.nodes', `A graph chart may declare at most ${MAX_GRAPH_NODES} nodes.`);
    return nodeIds;
  }
  for (const [index, candidate] of root.nodes.entries()) {
    const node = record(candidate, `$.nodes[${index}]`, issues);
    if (!node) continue;
    const id = token(node.id, NODE_ID, `$.nodes[${index}].id`, 'chart.node.id.invalid', issues);
    if (id && nodeIds.has(id)) add(issues, 'chart.node.id.duplicate', `$.nodes[${index}].id`, 'Node ids must be unique.');
    if (id) nodeIds.add(id);
    if (node.label !== undefined) text(node.label, `$.nodes[${index}].label`, 'chart.node.label.invalid', issues);
    if (node.group !== undefined) text(node.group, `$.nodes[${index}].group`, 'chart.node.group.invalid', issues);
  }
  return nodeIds;
}

/** the declared edges, including whether each end names a node that exists. */
function validateGraphEdges(root: MutableRecord, nodeIds: ReadonlySet<string>, issues: AdminSurfaceIssue[]): void {
  if (root.edges === undefined) return;
  if (!Array.isArray(root.edges)) {
    add(issues, 'chart.edges.invalid', '$.edges', 'edges must be an array.');
    return;
  }
  if (root.edges.length > MAX_GRAPH_EDGES) {
    add(issues, 'chart.edges.too_many', '$.edges', `A graph chart may declare at most ${MAX_GRAPH_EDGES} edges.`);
    return;
  }
  for (const [index, candidate] of root.edges.entries()) {
    const edge = record(candidate, `$.edges[${index}]`, issues);
    if (!edge) continue;
    const from = token(edge.from, NODE_ID, `$.edges[${index}].from`, 'chart.edge.from.invalid', issues);
    const to = token(edge.to, NODE_ID, `$.edges[${index}].to`, 'chart.edge.to.invalid', issues);
    if (edge.label !== undefined) text(edge.label, `$.edges[${index}].label`, 'chart.edge.label.invalid', issues);
    if (nodeIds.size === 0) continue;
    if (from && !nodeIds.has(from)) add(issues, 'chart.edge.unknown_node', `$.edges[${index}].from`, `Edge references undeclared node "${from}".`);
    if (to && !nodeIds.has(to)) add(issues, 'chart.edge.unknown_node', `$.edges[${index}].to`, `Edge references undeclared node "${to}".`);
  }
}

/** the literal series colours, when the spec declares any. */
function validateChartColors(root: MutableRecord, issues: AdminSurfaceIssue[]): void {
  if (root.colors === undefined) return;
  if (!Array.isArray(root.colors) || root.colors.length < 1 || root.colors.length > MAX_CHART_COLORS) {
    add(issues, 'chart.colors.invalid', '$.colors', `colors must be an array of 1 to ${MAX_CHART_COLORS} literal CSS hex values.`);
    return;
  }
  for (const [index, color] of root.colors.entries()) {
    if (typeof color !== 'string' || !CSS_HEX.test(color)) {
      add(issues, 'chart.color.invalid', `$.colors[${index}]`, 'Expected a literal CSS hex colour such as #059669.');
    }
  }
}

/** the two numbers a chart may cap itself with. */
function validateChartBounds(root: MutableRecord, issues: AdminSurfaceIssue[]): void {
  if (root.maxCategories !== undefined
    && (typeof root.maxCategories !== 'number' || !Number.isInteger(root.maxCategories) || root.maxCategories < 1 || root.maxCategories > 200)) {
    add(issues, 'chart.maxCategories.invalid', '$.maxCategories', 'maxCategories must be an integer between 1 and 200.');
  }
  if (root.height !== undefined
    && (typeof root.height !== 'number' || !Number.isFinite(root.height) || root.height <= 0 || root.height > 4096)) {
    add(issues, 'chart.height.invalid', '$.height', 'height must be a positive number of pixels.');
  }
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
