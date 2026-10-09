// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { createHash } from 'node:crypto';
export const PUBLIC_MODULE_CATALOG_PROFILE = Object.freeze({
    id: 'public-module-catalog',
    version: 1,
    deterministic: true,
});
/**
 * The schema address every catalogue must declare. The site serves the file
 * behind it, so the address and the file are one contract and are named once.
 */
export const PUBLIC_MODULE_CATALOG_SCHEMA_URL = 'https://ariada.org/schemas/public-module-catalog/v1.json';
export const PUBLIC_WIKI_LOCALES = Object.freeze([
    'en', 'sv', 'de', 'fr', 'es', 'it', 'pt-BR', 'nl', 'pl', 'ru',
    'uk', 'tr', 'ar', 'he', 'hi', 'bn', 'zh-CN', 'zh-TW', 'ja', 'ko',
    'id', 'vi', 'th', 'cs', 'ro', 'hu', 'fi', 'da', 'no', 'el',
] as const);

export type PublicModuleCatalogState = 'Planned' | 'In development' | 'Delivered' | 'Production';
export type DistributionStatus = 'planned' | 'in-development/local' | 'delivered';
export type DeploymentStatus = 'not-deployed' | 'deployed' | 'production';

export interface PublicInstallation {
    status: 'available' | 'unavailable';
    command: string | null;
    reason: string | null;
    instructionsUrl: string | null;
}

export interface PublicModuleCatalogChannel {
    id: string;
    number: number;
    name: string;
    description: string;
    roles: string[];
    useCases: string[];
    installation: PublicInstallation;
    wikiUrl: string;
    pack: number;
    state: PublicModuleCatalogState;
    distributionStatus: DistributionStatus;
    deploymentStatus: DeploymentStatus;
    developmentStarted: boolean;
    landed: boolean;
    published: boolean;
    publicationUrl: string | null;
    evidenceUrl: string | null;
    lastChangedAt: string | null;
    ariadaModuleUrl: string;
    githubModuleUrl: string | null;
    publicCodeUrl: string | null;
}

export interface PublicModuleCatalog {
    $schema: typeof PUBLIC_MODULE_CATALOG_SCHEMA_URL;
    version: 1;
    generatedAt: string;
    source: {
        repository: 'ariada-org/ariada';
        packCount: 24;
    };
    policy: {
        system: 'clamper';
        profile: 'public-module-catalog';
        version: 1;
    };
    wiki: {
        baseUrl: 'https://wiki.ariada.org';
        defaultLocale: 'en';
        locales: string[];
    };
    counts: {
        total: 236;
        planned: number;
        inDevelopment: number;
        delivered: number;
        production: number;
    };
    channels: PublicModuleCatalogChannel[];
    snapshotId: string;
}

export interface ClamperFinding {
    code: string;
    path: string;
    message: string;
}

export interface ClamperDecision {
    result: 'pass' | 'fail';
    profileId: 'public-module-catalog';
    profileVersion: 1;
    deterministic: true;
    decisionId: string;
    findings: ClamperFinding[];
}
const ROOT_KEYS = [
    '$schema',
    'version',
    'generatedAt',
    'source',
    'policy',
    'wiki',
    'counts',
    'channels',
    'snapshotId',
] as const;
const SOURCE_KEYS = ['repository', 'packCount'] as const;
const POLICY_KEYS = ['system', 'profile', 'version'] as const;
const WIKI_KEYS = ['baseUrl', 'defaultLocale', 'locales'] as const;
const COUNT_KEYS = ['total', 'planned', 'inDevelopment', 'delivered', 'production'] as const;
const CHANNEL_KEYS = [
    'id',
    'number',
    'name',
    'description',
    'roles',
    'useCases',
    'installation',
    'wikiUrl',
    'pack',
    'state',
    'distributionStatus',
    'deploymentStatus',
    'developmentStarted',
    'landed',
    'published',
    'publicationUrl',
    'evidenceUrl',
    'lastChangedAt',
    'ariadaModuleUrl',
    'githubModuleUrl',
    'publicCodeUrl',
] as const;
const INSTALLATION_KEYS = ['status', 'command', 'reason', 'instructionsUrl'] as const;
const STATES = new Set([
    'Planned',
    'In development',
    'Delivered',
    'Production',
]);
const FORBIDDEN_KEYS = new Set([
    'prd',
    'prdUrl',
    'path',
    'sourcePath',
    'evidencePath',
    'lastChangedCommit',
    'commit',
    'repositoryUrl',
]);
// Addresses are compared after parsing, by host and path, so that a look-alike
// host such as `wiki.ariada.org.example.net` is neither accepted nor confused
// with the real one.
function urlsIn(text: string): URL[] {
    const urls: URL[] = [];
    for (const token of text.match(/https?:\/\/[^\s"'<>()[\]{}`]+/gi) ?? []) {
        try {
            urls.push(new URL(token));
        }
        catch {
            // not an address; the other patterns still inspect the raw text
        }
    }
    return urls;
}
function mentionsUrl(text: string, host: string, path: RegExp): boolean {
    return urlsIn(text).some((url) => url.protocol === 'https:' && url.host === host && path.test(url.pathname));
}
const FORBIDDEN_TEXT: ReadonlyArray<readonly [string, RegExp | ((text: string) => boolean)]> = [
    ['gated-wiki-authority', (text) => mentionsUrl(text, 'wiki.klarads.com', /^\//)],
    ['retired-main-wiki-authority', /https:\/\/ariada\.org\/wiki(?:\/|$)/i],
    ['retired-wiki-catalog', (text) => mentionsUrl(text, 'wiki.ariada.org', /^\/[A-Za-z-]+\/ariada-module-catalog\//i)],
    ['internal-prd', /\bproduct[\\/]plans[\\/]|\bprd\b/i],
    ['internal-handoff', /\bhandoff\b/i],
    ['internal-source-path', /\b(?:apps|integrations|packages)[\\/]/i],
    ['private-artifact-path', /(?:^|[\\/])artifacts?[\\/]|scan-evidence/i],
    ['absolute-user-path', /(?:^|["'\s])(?:\/[Uu]sers\/|\/home\/|[A-Za-z]:\\\\)/],
];
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function canonicalize(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`;
    }
    if (isRecord(value)) {
        // BY CODE UNIT, AND NOT AS A MATTER OF STYLE. The catalogue's fingerprint
        // is taken from this, and the canonical form orders keys exactly so. A
        // locale-aware comparison would order keys differing only in case
        // differently — and so give the same content another fingerprint,
        // silently and for every past snapshot at once.
        return `{${Object.keys(value)
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
            .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}
function sha256(value: unknown): string {
    return createHash('sha256').update(canonicalize(value)).digest('hex');
}
export function createPublicModuleCatalogSnapshotId(input: unknown): string {
    if (!isRecord(input))
        return sha256(input);
    const withoutSnapshotId = { ...input };
    delete withoutSnapshotId.snapshotId;
    return sha256(withoutSnapshotId);
}
function addFinding(findings: ClamperFinding[], code: string, path: string, message: string): void {
    findings.push({ code, path, message });
}
function requireExactKeys(
    findings: ClamperFinding[],
    value: unknown,
    expected: readonly string[],
    path: string,
): value is Record<string, unknown> {
    if (!isRecord(value)) {
        addFinding(findings, 'schema.type', path, 'Expected an object.');
        return false;
    }
    // The order here affects nothing outside: both lists exist only to be
    // compared with each other, and findings are sorted before they are
    // returned. The comparison is named because a bare sort does not tell the
    // reader whether the order was chosen or inherited.
    const actual = Object.keys(value).sort((a, b) => a.localeCompare(b, 'en'));
    const wanted = [...expected].sort((a, b) => a.localeCompare(b, 'en'));
    for (const key of actual) {
        if (!wanted.includes(key)) {
            addFinding(findings, 'schema.extra-key', `${path}.${key}`, 'Unexpected public field.');
        }
    }
    for (const key of wanted) {
        if (!actual.includes(key)) {
            addFinding(findings, 'schema.missing-key', `${path}.${key}`, 'Required public field is missing.');
        }
    }
    return true;
}
function isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string')
        return false;
    try {
        return new URL(value).protocol === 'https:';
    }
    catch {
        return false;
    }
}
function inspectForbiddenContent(findings: ClamperFinding[], value: unknown, path = '$'): void {
    if (Array.isArray(value)) {
        for (const [index, entry] of value.entries()) {
            inspectForbiddenContent(findings, entry, `${path}[${index}]`);
        }
        return;
    }
    if (isRecord(value)) {
        for (const [key, entry] of Object.entries(value)) {
            if (FORBIDDEN_KEYS.has(key)) {
                addFinding(findings, 'dlp.internal-key', `${path}.${key}`, 'Internal metadata key is forbidden.');
            }
            inspectForbiddenContent(findings, entry, `${path}.${key}`);
        }
        return;
    }
    if (typeof value !== 'string')
        return;
    const inspected = path.endsWith('.publicCodeUrl') ? redactCanonicalPublicCodeUrls(value) : value;
    for (const [code, pattern] of FORBIDDEN_TEXT) {
        if (matchesForbidden(pattern, inspected)) {
            addFinding(findings, `dlp.${code}`, path, 'Internal-only content is forbidden.');
        }
    }
}
function matchesForbidden(pattern: RegExp | ((text: string) => boolean), text: string): boolean {
    return typeof pattern === 'function' ? pattern(text) : pattern.test(text);
}
function redactCanonicalPublicCodeUrls(value: string): string {
    return value.replace(/https:\/\/github\.com\/ariada-org\/core\/tree\/main\/(?:apps|integrations|packages)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/g, '[public-code-url]');
}
function validateStringArray(findings: ClamperFinding[], value: unknown, path: string): void {
    if (!Array.isArray(value) ||
        value.length < 1 ||
        value.length > 6 ||
        value.some((entry) => typeof entry !== 'string' || entry.trim().length < 3) ||
        new Set(value).size !== value.length) {
        addFinding(findings, 'catalog.reviewer-list', path, 'Expected 1-6 unique meaningful public strings.');
    }
}
function compareChannels(left: PublicModuleCatalogChannel, right: PublicModuleCatalogChannel): number {
    return (left.name.localeCompare(right.name, 'en', { sensitivity: 'base', numeric: true }) ||
        left.number - right.number);
}
function descriptionTemplate(channel: PublicModuleCatalogChannel): string {
    const escapedName = channel.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return channel.description
        .replace(new RegExp(escapedName, 'gi'), '{module}')
        .replace(/\bS\d+\b/g, '{id}')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
/**
 * The order of findings here is behaviour, not layout: the checks run top to
 * bottom and add to one list that a person reads. Split into parts in the
 * order they already stood; the early return on an unknown state stays where
 * it was, because it ends the whole inspection rather than skipping one check.
 */
function validateChannel(
    findings: ClamperFinding[],
    value: unknown,
    index: number,
): PublicModuleCatalogChannel | null {
    const path = `$.channels[${index}]`;
    if (!requireExactKeys(findings, value, CHANNEL_KEYS, path))
        return null;
    const channel = value as unknown as PublicModuleCatalogChannel;
    checkIdentity(findings, channel, path);
    if (!STATES.has(channel.state)) {
        addFinding(findings, 'catalog.state', `${path}.state`, 'Unsupported delivery state.');
        return channel;
    }
    const urls = checkFlagsAndUrls(findings, channel, path);
    const expected = expectedDelivery(channel, urls);
    checkDelivery(findings, channel, path, expected);
    checkInstallation(findings, channel, path, expected.hasCode, urls.expectedGithubUrl);
    return channel;
}

/** Number, name, description, roles, cases and package — everything that does not depend on URLs. */
function checkIdentity(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): void {
    if (!Number.isInteger(channel.number) || channel.number < 1 || channel.number > 236) {
        addFinding(findings, 'catalog.number', `${path}.number`, 'Module number must be an integer from 1 to 236.');
    }
    if (channel.id !== `S${channel.number}`) {
        addFinding(findings, 'catalog.id', `${path}.id`, 'Module id must match its S-number.');
    }
    for (const key of ['name', 'description'] as const) {
        if (typeof channel[key] !== 'string' || channel[key].trim().length === 0) {
            addFinding(findings, 'catalog.required-text', `${path}.${key}`, 'A non-empty public value is required.');
        }
    }
    if (typeof channel.description === 'string' && channel.description.trim().length < 60) {
        addFinding(findings, 'catalog.description', `${path}.description`, 'Reviewer description must be meaningful.');
    }
    validateStringArray(findings, channel.roles, `${path}.roles`);
    validateStringArray(findings, channel.useCases, `${path}.useCases`);
    if (!Number.isInteger(channel.pack) || channel.pack < 1 || channel.pack > 24) {
        addFinding(findings, 'catalog.pack', `${path}.pack`, 'Pack must be an integer from 1 to 24.');
    }
}

interface ChannelUrls {
    readonly expectedGithubUrl: string;
    readonly publicCodeUrlValid: boolean;
}

/** Flags, date and every URL. Returns what the delivery check needs. */
/** Flags and date: the boolean fields and the last change. */
function checkFlags(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): void {
    for (const key of ['developmentStarted', 'landed', 'published'] as const) {
        if (typeof channel[key] !== 'boolean') {
            addFinding(findings, 'schema.boolean', `${path}.${key}`, 'Expected a boolean.');
        }
    }
    if (channel.lastChangedAt !== null && !isIsoDate(channel.lastChangedAt)) {
        addFinding(findings, 'catalog.last-updated', `${path}.lastChangedAt`, 'Expected an ISO date or null.');
    }
}

/** The module's URL on the site: it follows from the number and cannot be anything else. */
function checkModuleUrl(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): void {
    if (channel.ariadaModuleUrl !== `https://ariada.org/modules/s${channel.number}/`) {
        addFinding(findings, 'catalog.ariada-url', `${path}.ariadaModuleUrl`, 'Ariada module URL is not canonical.');
    }
}

/** The wiki URL: the canonical path, with no fragment. */
function checkWikiUrl(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): void {
    const expectedWiki = `https://wiki.ariada.org/en/modules/s${channel.number}/`;
    if (channel.wikiUrl !== expectedWiki) {
        addFinding(findings, 'catalog.wiki-url', `${path}.wikiUrl`, 'Wiki URL must use the canonical per-module Ariada Wiki route.');
    }
    if (typeof channel.wikiUrl === 'string' && channel.wikiUrl.includes('#')) {
        addFinding(findings, 'catalog.wiki-fragment', `${path}.wikiUrl`, 'Wiki URL fragments are forbidden.');
    }
}

/** Code URLs: the canonical document and a link to the default branch. */
function checkCodeUrls(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): ChannelUrls {
    const expectedGithubUrl = `https://github.com/ariada-org/ariada/blob/main/docs/channel-modules/s${channel.number}.md`;
    if (channel.githubModuleUrl !== null && channel.githubModuleUrl !== expectedGithubUrl) {
        addFinding(findings, 'catalog.github-url', `${path}.githubModuleUrl`, 'GitHub module URL is not canonical.');
    }
    const publicCodeUrlValid = channel.publicCodeUrl === null ||
        (typeof channel.publicCodeUrl === 'string' &&
            /^https:\/\/github\.com\/ariada-org\/core\/tree\/main\/(?:apps|integrations|packages)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(channel.publicCodeUrl) &&
            !channel.publicCodeUrl.includes('..'));
    if (!publicCodeUrlValid) {
        addFinding(findings, 'catalog.code-url', `${path}.publicCodeUrl`, 'Public code URL must target ariada-org/ariada default branch.');
    }
    return { expectedGithubUrl, publicCodeUrlValid };
}

/** Publication and proof — each is either a public HTTPS URL or nothing. */
function checkPublicUrls(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): void {
    for (const key of ['publicationUrl', 'evidenceUrl'] as const) {
        if (channel[key] !== null && !isHttpsUrl(channel[key])) {
            addFinding(findings, 'catalog.public-url', `${path}.${key}`, 'Expected a public HTTPS URL or null.');
        }
    }
}

/**
 * The calls run in the order the checks stood when they were one sequence.
 * Findings are sorted before they are returned, so the order is invisible from
 * outside — but a reader compares it with the earlier form, and reordering
 * without a reason would leave them guessing whether there was one.
 */
function checkFlagsAndUrls(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
): ChannelUrls {
    checkFlags(findings, channel, path);
    checkModuleUrl(findings, channel, path);
    const urls = checkCodeUrls(findings, channel, path);
    checkWikiUrl(findings, channel, path);
    checkPublicUrls(findings, channel, path);
    return urls;
}

interface ExpectedDelivery {
    readonly hasCode: boolean;
    readonly hasProductionProof: boolean;
    readonly expectedDistributionStatus: string;
    readonly expectedDeploymentStatus: string;
    readonly expectedState: string;
}

/** What the module's state must be, given this evidence. Writes nothing. */
function expectedDelivery(
    channel: PublicModuleCatalogChannel,
    { expectedGithubUrl, publicCodeUrlValid }: ChannelUrls,
): ExpectedDelivery {
    const hasCode = channel.githubModuleUrl === expectedGithubUrl &&
        typeof channel.publicCodeUrl === 'string' &&
        publicCodeUrlValid;
    const hasProductionProof = hasCode && isHttpsUrl(channel.publicationUrl) && isHttpsUrl(channel.evidenceUrl);
    const expectedDistributionStatus = hasCode
        ? 'delivered'
        : channel.developmentStarted
            ? 'in-development/local'
            : 'planned';
    const expectedDeploymentStatus = hasProductionProof
        ? 'production'
        : isHttpsUrl(channel.publicationUrl)
            ? 'deployed'
            : 'not-deployed';
    const expectedState = hasProductionProof
        ? 'Production'
        : hasCode
            ? 'Delivered'
            : channel.developmentStarted
                ? 'In development'
                : 'Planned';
    return {
        hasCode,
        hasProductionProof,
        expectedDistributionStatus,
        expectedDeploymentStatus,
        expectedState,
    };
}

/** The declared state against the one the evidence implies. */
function checkDelivery(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
    {
        hasCode,
        hasProductionProof,
        expectedDistributionStatus,
        expectedDeploymentStatus,
        expectedState,
    }: ExpectedDelivery,
): void {
    if (channel.state !== expectedState) {
        addFinding(findings, 'catalog.state-proof', `${path}.state`, `State must be ${expectedState} for the available public proof.`);
    }
    if (channel.distributionStatus !== expectedDistributionStatus) {
        addFinding(findings, 'catalog.distribution-status', `${path}.distributionStatus`, `Expected ${expectedDistributionStatus}.`);
    }
    if (channel.deploymentStatus !== expectedDeploymentStatus) {
        addFinding(findings, 'catalog.deployment-status', `${path}.deploymentStatus`, `Expected ${expectedDeploymentStatus}.`);
    }
    if (channel.landed !== hasCode) {
        addFinding(findings, 'catalog.delivery-proof', `${path}.landed`, 'Delivered requires public default-branch code.');
    }
    if (channel.published !== hasProductionProof) {
        addFinding(findings, 'catalog.production-proof', `${path}.published`, 'Production requires code, release, and evidence URLs.');
    }
    if (hasCode && channel.developmentStarted !== true) {
        addFinding(findings, 'catalog.development-proof', `${path}.developmentStarted`, 'Delivered code must be marked as started.');
    }
    if (!hasCode && channel.landed) {
        addFinding(findings, 'catalog.false-delivery', `${path}.landed`, 'Local code cannot be reported as delivered.');
    }
}

/** The installation section: it must repeat what the code proves. */
function checkInstallation(
    findings: ClamperFinding[],
    channel: PublicModuleCatalogChannel,
    path: string,
    hasCode: boolean,
    expectedGithubUrl: string,
): void {
    if (requireExactKeys(findings, channel.installation, INSTALLATION_KEYS, `${path}.installation`)) {
        const expectedInstallation = hasCode
            ? {
                status: 'available',
                command: null,
                reason: null,
                instructionsUrl: expectedGithubUrl,
            }
            : {
                status: 'unavailable',
                command: null,
                reason: 'No public default-branch code URL has been verified.',
                instructionsUrl: null,
            };
        for (const key of INSTALLATION_KEYS) {
            if (channel.installation[key] !== expectedInstallation[key]) {
                addFinding(findings, 'catalog.installation', `${path}.installation.${key}`, 'Installation availability must match public delivery proof.');
            }
        }
    }
}
/** The header: schema, version, date generated. */
function checkHeader(findings: ClamperFinding[], input: Record<string, unknown>): void {
    if (input.$schema !== PUBLIC_MODULE_CATALOG_SCHEMA_URL) {
        addFinding(findings, 'schema.id', '$.$schema', 'Unsupported catalog schema.');
    }
    if (input.version !== 1)
        addFinding(findings, 'schema.version', '$.version', 'Version must be 1.');
    if (!isIsoDate(input.generatedAt)) {
        addFinding(findings, 'catalog.generated-at', '$.generatedAt', 'Expected an ISO generation date.');
    }
}

/** The source: whose repository, and how many packs it holds. */
function checkSource(findings: ClamperFinding[], input: Record<string, unknown>): void {
    if (requireExactKeys(findings, input.source, SOURCE_KEYS, '$.source')) {
        if (input.source.repository !== 'ariada-org/ariada') {
            addFinding(findings, 'catalog.repository', '$.source.repository', 'Public repository must be ariada-org/ariada.');
        }
        if (input.source.packCount !== 24) {
            addFinding(findings, 'catalog.pack-count', '$.source.packCount', 'Public catalog must contain 24 packs.');
        }
    }
}

/** The policy: the catalogue must name the system and profile that judge it. */
function checkPolicy(findings: ClamperFinding[], input: Record<string, unknown>): void {
    if (requireExactKeys(findings, input.policy, POLICY_KEYS, '$.policy') &&
        (input.policy.system !== 'clamper' ||
            input.policy.profile !== 'public-module-catalog' ||
            input.policy.version !== 1)) {
        addFinding(findings, 'catalog.policy', '$.policy', 'Catalog must declare Clamper public-module-catalog v1.');
    }
}

/** The wiki: root, default locale and the exact ordered list of locales. */
function checkWiki(findings: ClamperFinding[], input: Record<string, unknown>): void {
    if (requireExactKeys(findings, input.wiki, WIKI_KEYS, '$.wiki')) {
        if (input.wiki.baseUrl !== 'https://wiki.ariada.org') {
            addFinding(findings, 'catalog.wiki-base', '$.wiki.baseUrl', 'Wiki base URL is not canonical.');
        }
        if (input.wiki.defaultLocale !== 'en') {
            addFinding(findings, 'catalog.wiki-default-locale', '$.wiki.defaultLocale', 'Default Wiki locale must be en.');
        }
        if (!Array.isArray(input.wiki.locales) ||
            input.wiki.locales.length !== PUBLIC_WIKI_LOCALES.length ||
            input.wiki.locales.some((locale, index) => locale !== PUBLIC_WIKI_LOCALES[index]) ||
            new Set(input.wiki.locales).size !== PUBLIC_WIKI_LOCALES.length) {
            addFinding(findings, 'catalog.wiki-locales', '$.wiki.locales', 'Wiki locales must match the exact ordered 30-locale allowlist.');
        }
    }
}

/**
 * The modules themselves: their number, repeated descriptions, a complete set of
 * names, their order, and agreement with the counters. The counters come in from
 * outside, because they are read from the root and may not be readable at all.
 */
/** One description copied across modules is the mark of a placeholder. */
function checkRepeatedDescriptions(
    findings: ClamperFinding[],
    validChannels: readonly PublicModuleCatalogChannel[],
): void {
    const descriptionConcentration = new Map();
    for (const channel of validChannels) {
        const template = descriptionTemplate(channel);
        descriptionConcentration.set(template, (descriptionConcentration.get(template) || 0) + 1);
    }
    const concentratedTemplate = [...descriptionConcentration.entries()]
        .find(([, count]) => count > 12);
    if (concentratedTemplate) {
        addFinding(findings, 'catalog.description-concentration', '$.channels', `A normalized boilerplate description is repeated ${concentratedTemplate[1]} times.`);
    }
}

/** The set of names must be complete and without repeats. */
function checkNames(
    findings: ClamperFinding[],
    validChannels: readonly PublicModuleCatalogChannel[],
): void {
    const ids = new Set(validChannels.map((channel) => channel.id));
    const expectedIds = Array.from({ length: 236 }, (_, index) => `S${index + 1}`);
    if (ids.size !== 236 || expectedIds.some((id) => !ids.has(id))) {
        addFinding(findings, 'catalog.ids', '$.channels', 'Catalog must contain each of the 236 channel ids exactly once.');
    }
}

/** Order: by name, then by number. Only the first place out of order is reported. */
function checkOrder(
    findings: ClamperFinding[],
    validChannels: readonly (PublicModuleCatalogChannel | null)[],
): void {
    for (let index = 1; index < validChannels.length; index += 1) {
        const previous = validChannels[index - 1];
        const current = validChannels[index];
        if (previous && current && compareChannels(previous, current) > 0) {
            addFinding(findings, 'catalog.order', `$.channels[${index}]`, 'Modules must use alphabetical name order with number tie-break.');
            break;
        }
    }
}

/** The counters must match what the set actually holds. */
function checkCounters(
    findings: ClamperFinding[],
    counts: Record<string, unknown>,
    validChannels: readonly PublicModuleCatalogChannel[],
): void {
    const actual = {
        total: validChannels.length,
        planned: validChannels.filter((channel) => channel.state === 'Planned').length,
        inDevelopment: validChannels.filter((channel) => channel.state === 'In development').length,
        delivered: validChannels.filter((channel) => channel.state === 'Delivered').length,
        production: validChannels.filter((channel) => channel.state === 'Production').length,
    };
    for (const key of COUNT_KEYS) {
        if (!Number.isInteger(counts[key]) || counts[key] !== actual[key]) {
            addFinding(findings, 'catalog.counts', `$.counts.${key}`, `Expected ${actual[key]}.`);
        }
    }
    if (counts.total !== 236) {
        addFinding(findings, 'catalog.total', '$.counts.total', 'Total must be 236.');
    }
}

function checkChannels(
    findings: ClamperFinding[],
    input: Record<string, unknown>,
    counts: Record<string, unknown> | null,
): void {
    const channels = Array.isArray(input.channels)
    ? input.channels.map((channel, index) => validateChannel(findings, channel, index))
    : null;
    if (channels === null) {
    addFinding(findings, 'schema.type', '$.channels', 'Expected an array.');
    }
    else {
    if (channels.length !== 236) {
        addFinding(findings, 'catalog.completeness', '$.channels', 'Catalog must contain exactly 236 modules.');
    }
    const validChannels = channels.filter((channel) => channel !== null);
    checkRepeatedDescriptions(findings, validChannels);
    checkNames(findings, validChannels);
    checkOrder(findings, validChannels);
    if (counts) {
        checkCounters(findings, counts, validChannels);
    }
    }
}

/** The snapshot identifier: it must be the fingerprint of exactly this content. */
function checkSnapshot(findings: ClamperFinding[], input: Record<string, unknown>): void {
    if (typeof input.snapshotId !== 'string' || !/^[a-f0-9]{64}$/.test(input.snapshotId)) {
        addFinding(findings, 'catalog.snapshot-id', '$.snapshotId', 'Snapshot id must be a lowercase SHA-256 digest.');
    }
    else {
        const expectedSnapshotId = createPublicModuleCatalogSnapshotId(input);
        if (input.snapshotId !== expectedSnapshotId) {
            addFinding(findings, 'catalog.snapshot-digest', '$.snapshotId', 'Snapshot id does not match catalog content.');
        }
    }
}

/**
 * The order of checks is behaviour: findings go into one list and are sorted at
 * the end, but before that both a person and the decision fingerprint read
 * them. Split in exactly the order it stood.
 */
export function evaluateClamperProfile(profileId: string, input: unknown): ClamperDecision {
    if (profileId !== PUBLIC_MODULE_CATALOG_PROFILE.id) {
        throw new Error(`Unknown Clamper profile: ${profileId}`);
    }
    const findings: ClamperFinding[] = [];
    inspectForbiddenContent(findings, input);
    if (requireExactKeys(findings, input, ROOT_KEYS, '$')) {
        checkHeader(findings, input);
        checkSource(findings, input);
        checkPolicy(findings, input);
        checkWiki(findings, input);
        const counts = requireExactKeys(findings, input.counts, COUNT_KEYS, '$.counts')
            ? input.counts
            : null;
        checkChannels(findings, input, counts);
        checkSnapshot(findings, input);
    }
    const orderedFindings = findings.sort((left, right) => `${left.path}\u0000${left.code}\u0000${left.message}`.localeCompare(`${right.path}\u0000${right.code}\u0000${right.message}`));
    const decisionId = sha256({
        profileId: PUBLIC_MODULE_CATALOG_PROFILE.id,
        profileVersion: PUBLIC_MODULE_CATALOG_PROFILE.version,
        input,
        findings: orderedFindings,
    });
    return {
        result: orderedFindings.length === 0 ? 'pass' : 'fail',
        profileId: PUBLIC_MODULE_CATALOG_PROFILE.id,
        profileVersion: PUBLIC_MODULE_CATALOG_PROFILE.version,
        deterministic: true,
        decisionId,
        findings: orderedFindings,
    };
}
export function assertClamperProfile(profileId: string, input: unknown): ClamperDecision {
    const decision = evaluateClamperProfile(profileId, input);
    if (decision.result === 'fail') {
        const details = decision.findings
            .map((finding) => `${finding.code} ${finding.path}: ${finding.message}`)
            .join('\n');
        throw new Error(`Clamper ${decision.profileId}:v${decision.profileVersion} rejected public catalog (${decision.decisionId}).\n${details}`);
    }
    return decision;
}
function publicArtifactDecision(input: unknown, findings: ClamperFinding[]): ClamperDecision {
    const orderedFindings = findings.sort((left, right) => `${left.path}\u0000${left.code}\u0000${left.message}`.localeCompare(`${right.path}\u0000${right.code}\u0000${right.message}`));
    return {
        result: orderedFindings.length === 0 ? 'pass' : 'fail',
        profileId: PUBLIC_MODULE_CATALOG_PROFILE.id,
        profileVersion: PUBLIC_MODULE_CATALOG_PROFILE.version,
        deterministic: true,
        decisionId: sha256({
            profileId: PUBLIC_MODULE_CATALOG_PROFILE.id,
            profileVersion: PUBLIC_MODULE_CATALOG_PROFILE.version,
            input,
            findings: orderedFindings,
        }),
        findings: orderedFindings,
    };
}
export function evaluateClamperPublicText(profileId: string, input: unknown): ClamperDecision {
    if (profileId !== PUBLIC_MODULE_CATALOG_PROFILE.id) {
        throw new Error(`Unknown Clamper profile: ${profileId}`);
    }
    const findings: ClamperFinding[] = [];
    if (typeof input !== 'string' || input.trim().length === 0) {
        addFinding(findings, 'text.required', '$text', 'Public text must be non-empty.');
    }
    else {
        inspectForbiddenContent(findings, redactCanonicalPublicCodeUrls(input), '$text');
        if (!mentionsUrl(input, 'ariada.org', /^\/modules\//)) {
            addFinding(findings, 'text.catalog-authority', '$text', 'Public module catalog authority is missing.');
        }
        if (!PUBLIC_WIKI_LOCALES.every((locale) => mentionsUrl(input, 'wiki.ariada.org', new RegExp(`^/${locale}/modules/`)))) {
            addFinding(findings, 'text.wiki-authority', '$text', 'Ariada public Wiki projection authority is missing.');
        }
        if (!mentionsUrl(input, 'github.com', /^\/ariada-org\/ariada(?:$|[/.#?])/)) {
            addFinding(findings, 'text.code-authority', '$text', 'Public GitHub authority is missing.');
        }
    }
    return publicArtifactDecision(input, findings);
}
export function assertClamperPublicText(profileId: string, input: unknown): ClamperDecision {
    const decision = evaluateClamperPublicText(profileId, input);
    if (decision.result === 'fail') {
        throw new Error(`Clamper ${decision.profileId}:v${decision.profileVersion} rejected public text (${decision.decisionId}).\n` +
            decision.findings.map((finding) => `${finding.code} ${finding.path}: ${finding.message}`).join('\n'));
    }
    return decision;
}
const AI_CITATION_CRAWLERS = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'Google-Extended',
    'CCBot',
    'Bytespider',
    'PerplexityBot',
    'Perplexity-User',
    'Applebot-Extended',
];
export function evaluateClamperRobots(profileId: string, input: unknown): ClamperDecision {
    if (profileId !== PUBLIC_MODULE_CATALOG_PROFILE.id) {
        throw new Error(`Unknown Clamper profile: ${profileId}`);
    }
    const findings: ClamperFinding[] = [];
    if (typeof input !== 'string' || input.trim().length === 0) {
        addFinding(findings, 'robots.required', '$robots', 'robots.txt must be non-empty.');
        return publicArtifactDecision(input, findings);
    }
    inspectForbiddenContent(findings, input, '$robots');
    if (!/^Sitemap: https:\/\/ariada\.org\/sitemap-index\.xml$/m.test(input)) {
        addFinding(findings, 'robots.sitemap', '$robots', 'Canonical sitemap directive is required.');
    }
    if (/^(?:Allow|Disallow): \/wiki(?:\/|$)/mi.test(input) || /^Sitemap: .*wiki/mi.test(input)) {
        addFinding(findings, 'robots.wiki-boundary', '$robots', 'Main-site robots.txt must not govern the Wiki subdomain.');
    }
    if (!/^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m.test(input) || /ai-train=yes/i.test(input)) {
        addFinding(findings, 'robots.training', '$robots', 'AI training must remain disabled.');
    }
    for (const userAgent of AI_CITATION_CRAWLERS) {
        const escaped = userAgent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = input.match(new RegExp(`User-agent: ${escaped}\\n([\\s\\S]*?)(?=\\nUser-agent:|\\nSitemap:|$)`, 'i'));
        if (!match) {
            addFinding(findings, 'robots.user-agent', `$robots.${userAgent}`, 'Citation crawler group is missing.');
            continue;
        }
        const directives = (match[1] || '').split('\n').map((line) => line.trim()).filter(Boolean);
        for (const directive of [
            'Disallow: /',
            'Allow: /modules/',
            'Allow: /channel-matrix.json',
            'Allow: /llms.txt',
        ]) {
            if (!directives.includes(directive)) {
                addFinding(findings, 'robots.path-policy', `$robots.${userAgent}`, `Required directive is missing: ${directive}`);
            }
        }
        if (directives.includes('Allow: /')) {
            addFinding(findings, 'robots.global-ai-allow', `$robots.${userAgent}`, 'AI crawler access must remain path-scoped.');
        }
    }
    return publicArtifactDecision(input, findings);
}
export function assertClamperRobots(profileId: string, input: unknown): ClamperDecision {
    const decision = evaluateClamperRobots(profileId, input);
    if (decision.result === 'fail') {
        throw new Error(`Clamper ${decision.profileId}:v${decision.profileVersion} rejected robots.txt (${decision.decisionId}).\n` +
            decision.findings.map((finding) => `${finding.code} ${finding.path}: ${finding.message}`).join('\n'));
    }
    return decision;
}
