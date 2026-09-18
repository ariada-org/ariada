import { fileURLToPath } from "node:url";

import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import type { ScanCommandFactory, ScanCommandInputs, ScanCommandResult } from "./types.js";
const DEFAULT_CLI_PATH = fileURLToPath(new URL("./bin.js", import.meta.resolve("@ariada-org/cli")));
const COMMAND_PROGRAM = String.raw `
"use strict";
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error("Missing command environment variable: " + name);
  }
  return value;
}

const outputDir = mkdtempSync(join(tmpdir(), "pulumi-ariada-"));
try {
  const result = spawnSync(
    process.execPath,
    [
      required("ARIADA_CLI_PATH"),
      "scan",
      required("ARIADA_URL"),
      "--browser",
      required("ARIADA_BROWSER"),
      "--severity-threshold",
      required("ARIADA_SEVERITY_THRESHOLD"),
      "--timeout-ms",
      required("ARIADA_TIMEOUT_MS"),
      "--format",
      "json",
      "--output-dir",
      outputDir,
    ],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(result.error.message + "\n");

  const status = result.status === null ? 3 : result.status;
  if (status === 0 || status === 1) {
    process.stdout.write(readFileSync(join(outputDir, "scan.json"), "utf8"));
  } else {
    process.exitCode = status;
  }
} finally {
  rmSync(outputDir, { force: true, recursive: true });
}
`;
/**
 * Default provisioning adapter backed by command.local.Command.
 * Source: https://www.pulumi.com/registry/packages/command/api-docs/local/command/
 */
export class AriadaCommandFactory implements ScanCommandFactory {
    private readonly cliPath: string;

    constructor(cliPath: string = DEFAULT_CLI_PATH) {
        this.cliPath = cliPath;
    }
    create(
        name: string,
        inputs: ScanCommandInputs,
        opts: pulumi.CustomResourceOptions,
    ): ScanCommandResult {
        const timeoutMs = pulumi
            .output(inputs.timeoutMs)
            .apply((value) => String(value));
        const execution = new command.local.Command(name, {
            create: COMMAND_PROGRAM,
            environment: {
                ARIADA_BROWSER: inputs.browser,
                ARIADA_CLI_PATH: this.cliPath,
                ARIADA_SEVERITY_THRESHOLD: inputs.severityThreshold,
                ARIADA_TIMEOUT_MS: timeoutMs,
                ARIADA_URL: inputs.url,
            },
            interpreter: [process.execPath, "-e"],
            logging: command.local.Logging.None,
            triggers: [
                inputs.url,
                inputs.browser,
                inputs.severityThreshold,
                inputs.timeoutMs,
                inputs.refreshToken,
            ],
        }, opts);
        return { stdout: execution.stdout };
    }
}
