import * as pulumi from "@pulumi/pulumi";

import { AriadaCommandFactory } from "./command.js";
import { parseScanJson } from "./report.js";
import type { ScanArgs, ScanResourceOptions, ViolationCounts } from "./types.js";
export const SCAN_RESOURCE_TYPE = "ariada:index:Scan";
/**
 * A TypeScript Pulumi component that delegates scanning to @ariada-org/cli.
 * Source: https://www.pulumi.com/docs/iac/concepts/resources/components/
 */
export class Scan extends pulumi.ComponentResource {
    readonly score: pulumi.Output<number>;
    readonly violations: pulumi.Output<number>;
    readonly pass: pulumi.Output<boolean>;
    readonly counts: pulumi.Output<ViolationCounts>;

    constructor(name: string, args: ScanArgs, opts: ScanResourceOptions = {}) {
        const { commandFactory, ...componentOptions } = opts;
        const browser = args.browser ?? "chromium";
        const severityThreshold = args.severityThreshold ?? "moderate";
        const timeoutMs = args.timeoutMs ?? 30_000;
        const refreshToken = args.refreshToken ?? "initial";
        super(SCAN_RESOURCE_TYPE, name, {
            url: args.url,
            browser,
            severityThreshold,
            timeoutMs,
            refreshToken,
        }, componentOptions);
        const execution = (commandFactory ?? new AriadaCommandFactory()).create(`${name}-scan`, {
            url: args.url,
            browser,
            severityThreshold,
            timeoutMs,
            refreshToken,
        }, { parent: this });
        const result = execution.stdout.apply(parseScanJson);
        this.score = result.apply((value) => value.score);
        this.violations = result.apply((value) => value.violations);
        this.pass = result.apply((value) => value.pass);
        this.counts = result.apply((value) => value.counts);
        this.registerOutputs({
            score: this.score,
            violations: this.violations,
            pass: this.pass,
            counts: this.counts,
        });
    }
}
