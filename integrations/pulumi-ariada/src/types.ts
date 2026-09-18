import type * as pulumi from "@pulumi/pulumi";
export type Browser = "chromium" | "firefox" | "webkit";
export type SeverityThreshold = "minor" | "moderate" | "serious" | "critical";
export interface ViolationCounts {
    readonly critical: number;
    readonly serious: number;
    readonly moderate: number;
    readonly minor: number;
}
export interface ScanArgs {
    /** HTTP(S) target authorized for accessibility scanning. */
    readonly url: pulumi.Input<string>;
    /** Browser engine used by Ariada. Defaults to chromium. */
    readonly browser?: pulumi.Input<Browser>;
    /** Minimum severity that makes pass false. Defaults to moderate. */
    readonly severityThreshold?: pulumi.Input<SeverityThreshold>;
    /** Ariada's per-URL navigation timeout. Defaults to 30000. */
    readonly timeoutMs?: pulumi.Input<number>;
    /** Change this stable token to force a rescan when other inputs are unchanged. */
    readonly refreshToken?: pulumi.Input<string>;
}
export interface ScanCommandInputs {
    readonly url: pulumi.Input<string>;
    readonly browser: pulumi.Input<Browser>;
    readonly severityThreshold: pulumi.Input<SeverityThreshold>;
    readonly timeoutMs: pulumi.Input<number>;
    readonly refreshToken: pulumi.Input<string>;
}
export interface ScanCommandResult {
    /** The complete contents of the CLI-generated scan.json artifact. */
    readonly stdout: pulumi.Output<string>;
}
/** Injectable provisioning boundary used by the component and deterministic tests. */
export interface ScanCommandFactory {
    create(name: string, inputs: ScanCommandInputs, opts: pulumi.CustomResourceOptions): ScanCommandResult;
}
export interface ScanResourceOptions extends pulumi.ComponentResourceOptions {
    /** Advanced test/adapter seam. Production callers normally use the default. */
    readonly commandFactory?: ScanCommandFactory;
}
export interface NormalizedScanResult {
    readonly score: number;
    readonly violations: number;
    readonly pass: boolean;
    readonly counts: ViolationCounts;
}
