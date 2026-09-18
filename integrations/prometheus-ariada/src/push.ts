import { Pushgateway, type Registry } from "prom-client";

export interface PushAdapter {
    push(): Promise<void>;
}

export interface PushgatewayPushParameters {
    readonly jobName: string;
    readonly groupings?: Readonly<Record<string, string>>;
}

export interface PushgatewayClient {
    push(parameters: PushgatewayPushParameters): Promise<unknown>;
}

export interface PromClientPushAdapterOptions {
    readonly url: string;
    readonly jobName: string;
    readonly registry: Registry;
    readonly groupings?: Readonly<Record<string, string>>;
    readonly gateway?: PushgatewayClient;
}
// Credentials in the address are refused rather than stripped. A gateway URL
// carrying a password would put it in every log line that prints the target.
function validatePushgatewayUrl(value: string): void {
    let url: URL;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error("Pushgateway URL must be an absolute URL");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Pushgateway URL must use http or https");
    }
    if (url.username !== "" || url.password !== "") {
        throw new Error("Pushgateway URL must not contain credentials");
    }
}
function copyGroupings(
    groupings: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
    if (groupings === undefined) {
        return undefined;
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(groupings)) {
        if (key.length === 0 || key.trim() !== key) {
            throw new Error("Pushgateway grouping names must be non-empty");
        }
        if (value.length === 0 || value.trim() !== value) {
            throw new Error("Pushgateway grouping values must be non-empty");
        }
        result[key] = value;
    }
    return result;
}
export function createPromClientPushAdapter(options: PromClientPushAdapterOptions): PushAdapter {
    validatePushgatewayUrl(options.url);
    if (options.jobName.length === 0 ||
        options.jobName.trim() !== options.jobName) {
        throw new Error("Pushgateway job name must be non-empty");
    }
    const groupings = copyGroupings(options.groupings);
    let gateway: PushgatewayClient;
    if (options.gateway !== undefined) {
        gateway = options.gateway;
    }
    else {
        const client = new Pushgateway(options.url, {}, options.registry);
        gateway = {
            push: async (parameters: PushgatewayPushParameters) => client.push(parameters),
        };
    }
    return {
        async push() {
            const parameters = groupings === undefined
                ? { jobName: options.jobName }
                : { jobName: options.jobName, groupings };
            await gateway.push(parameters);
        },
    };
}
