import {
    ARIADA_IMPACTS,
    DATADOG_SITES,
    type AriadaImpact,
    type AriadaResult,
    type AriadaViolation,
    type DatadogConfig,
    type DatadogSite,
    type DatadogTransport,
    type SendToDatadogOptions,
} from "./types.js";

const RESULT_KEYS = ["url", "score", "gate", "violations"] as const;
const VIOLATION_KEYS = ["rule", "impact", "count"] as const;
const CONFIG_KEYS = ["apiKey", "appKey", "site"] as const;
const OPTION_KEYS = [
    "apiKey",
    "appKey",
    "site",
    "timestamp",
    "transport",
] as const;
const RULE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/u;
const CREDENTIAL_MAX_LENGTH = 256;
const URL_MAX_LENGTH = 190;
export class AriadaValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AriadaValidationError";
    }
}
function expectRecord(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new AriadaValidationError(`${label} must be an object`);
    }
    return value as Record<string, unknown>;
}

// Unknown fields are refused, not ignored. A caller passing `apiKeyy` would
// otherwise send a payload with no credential and be told nothing about why.
function assertExactKeys(
    value: Record<string, unknown>,
    expected: readonly string[],
    label: string,
): void {
    const missing = expected.filter((key) => !Object.hasOwn(value, key));
    const unknown = Object.keys(value)
        .filter((key) => !expected.includes(key))
        .sort((odin, drugoy) => odin.localeCompare(drugoy, 'en'));
    if (missing.length > 0) {
        throw new AriadaValidationError(`${label} is missing required field(s): ${missing.join(", ")}`);
    }
    if (unknown.length > 0) {
        throw new AriadaValidationError(`${label} has unknown field(s): ${unknown.join(", ")}`);
    }
}
function expectString(value: unknown, label: string, maximumLength: number): string {
    if (typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximumLength ||
        value.trim() !== value ||
        hasControlCharacters(value)) {
        throw new AriadaValidationError(`${label} must be a non-empty, trimmed string of at most ${maximumLength} characters without control characters`);
    }
    return value as string;
}

// Control characters are refused rather than escaped: a newline inside a tag
// splits one line of a log into two, and the second one looks like a record
// nobody wrote.
function hasControlCharacters(value: string): boolean {
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
            return true;
        }
    }
    return false;
}
function parseUrl(value: unknown): string {
    const url = expectString(value, "result.url", URL_MAX_LENGTH);
    let parsed: URL;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new AriadaValidationError("result.url must be an absolute URL");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new AriadaValidationError("result.url must use http or https");
    }
    if (parsed.username !== "" || parsed.password !== "") {
        throw new AriadaValidationError("result.url must not contain credentials");
    }
    return url;
}
function parseScore(value: unknown): number {
    if (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100) {
        throw new AriadaValidationError("result.score must be a finite number from 0 through 100");
    }
    return value;
}
function parseImpact(value: unknown, label: string): AriadaImpact {
    if (typeof value !== "string" ||
        !ARIADA_IMPACTS.includes(value as AriadaImpact)) {
        throw new AriadaValidationError(`${label} must be one of: ${ARIADA_IMPACTS.join(", ")}`);
    }
    return value as AriadaImpact;
}

function parseViolation(value: unknown, index: number): AriadaViolation {
    const label = `result.violations[${index}]`;
    const record = expectRecord(value, label);
    assertExactKeys(record, VIOLATION_KEYS, label);
    const rule = expectString(record["rule"], `${label}.rule`, 100);
    if (!RULE_PATTERN.test(rule)) {
        throw new AriadaValidationError(`${label}.rule must match ${RULE_PATTERN.source}`);
    }
    const count = record["count"];
    if (typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count <= 0) {
        throw new AriadaValidationError(`${label}.count must be a positive safe integer`);
    }
    return {
        rule,
        impact: parseImpact(record["impact"], `${label}.impact`),
        count,
    };
}
export function parseAriadaResult(value: unknown): AriadaResult {
    const record = expectRecord(value, "result");
    assertExactKeys(record, RESULT_KEYS, "result");
    if (record["gate"] !== "pass" && record["gate"] !== "fail") {
        throw new AriadaValidationError('result.gate must be either "pass" or "fail"');
    }
    if (!Array.isArray(record["violations"])) {
        throw new AriadaValidationError("result.violations must be an array");
    }
    const violations = record["violations"].map(parseViolation);
    // The same rule at the same impact twice would become two series with one
    // set of tags, and the collector keeps whichever arrived last.
    const pairs = new Set<string>();
    for (const violation of violations) {
        const pair = `${violation.rule}\u0000${violation.impact}`;
        if (pairs.has(pair)) {
            throw new AriadaValidationError(`result.violations contains duplicate rule/impact pair: ${violation.rule}/${violation.impact}`);
        }
        pairs.add(pair);
    }
    return {
        url: parseUrl(record["url"]),
        score: parseScore(record["score"]),
        gate: record["gate"] as AriadaResult["gate"],
        violations,
    };
}
export function parseAriadaJson(json: string): AriadaResult {
    let value: unknown;
    try {
        value = JSON.parse(json);
    }
    catch {
        throw new AriadaValidationError("input must be valid JSON");
    }
    return parseAriadaResult(value);
}
function parseCredential(value: unknown, label: string): string {
    return expectString(value, label, CREDENTIAL_MAX_LENGTH);
}
export function parseDatadogConfig(value: unknown): DatadogConfig {
    const record = expectRecord(value, "Datadog config");
    assertExactKeys(record, CONFIG_KEYS, "Datadog config");
    const site = record["site"];
    if (typeof site !== "string" ||
        !DATADOG_SITES.includes(site as DatadogSite)) {
        throw new AriadaValidationError(`Datadog config.site must be one of: ${DATADOG_SITES.join(", ")}`);
    }
    return {
        apiKey: parseCredential(record["apiKey"], "Datadog config.apiKey"),
        appKey: parseCredential(record["appKey"], "Datadog config.appKey"),
        site: site as DatadogSite,
    };
}
export function parseDatadogEnvironment(environment: Readonly<Record<string, string | undefined>>): DatadogConfig {
    return parseDatadogConfig({
        apiKey: environment["DD_API_KEY"],
        appKey: environment["DD_APP_KEY"],
        site: environment["DD_SITE"],
    });
}
export function parseTimestamp(value: unknown, label = "timestamp"): number {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 0) {
        throw new AriadaValidationError(`${label} must be a non-negative POSIX timestamp in whole seconds`);
    }
    return value as number;
}

interface ParsedSendOptions {
    readonly config: DatadogConfig;
    readonly timestamp?: number;
    readonly transport?: DatadogTransport;
}

export function parseSendOptions(value: unknown): ParsedSendOptions {
    const record = expectRecord(value, "send options");
    const keys = Object.keys(record);
    const unknown = keys
        .filter((key) => !(OPTION_KEYS as readonly string[]).includes(key))
        .sort((odin, drugoy) => odin.localeCompare(drugoy, 'en'));
    if (unknown.length > 0) {
        throw new AriadaValidationError(`send options has unknown field(s): ${unknown.join(", ")}`);
    }
    const config = parseDatadogConfig({
        apiKey: record["apiKey"],
        appKey: record["appKey"],
        site: record["site"],
    });
    const timestamp = record["timestamp"];
    const transport = record["transport"];
    if (transport !== undefined &&
        (typeof transport !== "object" ||
            transport === null ||
            typeof (transport as Record<string, unknown>)["send"] !== "function")) {
        throw new AriadaValidationError("send options.transport must implement send(request)");
    }
    return {
        config,
        ...(timestamp === undefined
            ? {}
            : { timestamp: parseTimestamp(timestamp) }),
        ...(transport === undefined
            ? {}
            : { transport: transport as DatadogTransport }),
    };
}
export function asSendOptions(
    config: DatadogConfig,
    timestamp: number,
    transport?: DatadogTransport,
): SendToDatadogOptions {
    return {
        ...config,
        timestamp,
        ...(transport === undefined ? {} : { transport }),
    };
}
