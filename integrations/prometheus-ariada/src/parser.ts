export interface AriadaViolation {
    readonly rule: string;
    readonly impact: string;
    readonly url: string;
    readonly count: number;
}

export interface AriadaScan {
    readonly url: string;
    readonly score: number;
    readonly gate: boolean;
    readonly timestamp: string;
    readonly violations: readonly AriadaViolation[];
}

/** An error that names the path it was found at, so a caller can point at the field. */
export class AriadaParseError extends Error {
    constructor(path: string, message: string) {
        super(`${path}: ${message}`);
        this.name = "AriadaParseError";
    }
}
const ISO_8601_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
function fail(path: string, message: string): never {
    throw new AriadaParseError(path, message);
}
function hasOwn(record: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key);
}
function expectRecord(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return fail(path, "must be an object");
    }
    return value as Record<string, unknown>;
}

// Unknown keys are refused rather than ignored. A scan artifact from a newer
// scanner carrying a field this exporter does not understand is a fact the
// operator should hear about, not one to silently drop.
function assertExactKeys(
    record: Record<string, unknown>,
    path: string,
    required: readonly string[],
    optional: readonly string[] = [],
): void {
    for (const key of required) {
        if (!hasOwn(record, key)) {
            fail(`${path}.${key}`, "is required");
        }
    }
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
            fail(`${path}.${key}`, "is not allowed");
        }
    }
}
function expectNonEmptyString(value: unknown, path: string): string {
    if (typeof value !== "string" ||
        value.length === 0 ||
        value.trim() !== value) {
        return fail(path, "must be a non-empty string without surrounding whitespace");
    }
    return value;
}
function expectUrl(value: unknown, path: string): string {
    const url = expectNonEmptyString(value, path);
    let parsed: URL;
    try {
        parsed = new URL(url);
    }
    catch {
        return fail(path, "must be an absolute URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return fail(path, "must use http or https");
    }
    if (parsed.username !== "" || parsed.password !== "") {
        return fail(path, "must not contain credentials");
    }
    return url;
}
function expectTimestamp(value: unknown, path: string): string {
    const timestamp = expectNonEmptyString(value, path);
    if (!ISO_8601_TIMESTAMP.test(timestamp) ||
        !Number.isFinite(Date.parse(timestamp))) {
        return fail(path, "must be a valid ISO-8601 timestamp with a timezone");
    }
    return timestamp;
}
function expectScore(value: unknown, path: string): number {
    if (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100) {
        return fail(path, "must be a finite number from 0 through 100");
    }
    return value;
}
function expectCount(value: unknown, path: string): number {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 1) {
        return fail(path, "must be a positive safe integer");
    }
    return value;
}
function parseViolation(value: unknown, path: string, scanUrl: string): AriadaViolation {
    const record = expectRecord(value, path);
    assertExactKeys(record, path, ["rule", "impact"], ["url", "count"]);
    return {
        rule: expectNonEmptyString(record.rule, `${path}.rule`),
        impact: expectNonEmptyString(record.impact, `${path}.impact`),
        url: hasOwn(record, "url")
            ? expectUrl(record.url, `${path}.url`)
            : scanUrl,
        count: hasOwn(record, "count")
            ? expectCount(record.count, `${path}.count`)
            : 1,
    };
}
function parseInput(input: unknown): unknown {
    if (typeof input !== "string") {
        return input;
    }
    try {
        return JSON.parse(input);
    }
    catch {
        return fail("$", "must be valid JSON");
    }
}
export function parseAriadaScan(input: unknown): AriadaScan {
    const record = expectRecord(parseInput(input), "$");
    assertExactKeys(record, "$", [
        "url",
        "score",
        "gate",
        "timestamp",
        "violations",
    ]);
    const url = expectUrl(record.url, "$.url");
    const violationsInput = record.violations;
    if (!Array.isArray(violationsInput)) {
        return fail("$.violations", "must be an array");
    }
    if (typeof record.gate !== "boolean") {
        return fail("$.gate", "must be a boolean");
    }
    return {
        url,
        score: expectScore(record.score, "$.score"),
        gate: record.gate,
        timestamp: expectTimestamp(record.timestamp, "$.timestamp"),
        violations: violationsInput.map((violation, index) => parseViolation(violation, `$.violations[${index}]`, url)),
    };
}
