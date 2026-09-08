// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/target.js` and `dist/target.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The three ways of naming what to scan are tried in order of how directly they
// say it: an explicit address wins over a directory, and a directory over an
// address assembled from a hosting service's identifiers. The assembled one is
// last because it is the only one that can be wrong while looking right.
//
// WHICH IS WHY BOTH ITS PARTS ARE CHECKED AGAINST THE SHAPE THE SERVICE ACTUALLY
// USES. An identifier that is not of the expected form, or a branch name that is
// not already a valid host label, would produce a plausible address for a
// different site — or for nobody — and the scan would report on whatever
// answered. The error says to use an explicit address instead, because that is
// the real remedy: a branch displayed under a name with spaces or capitals has a
// host label this cannot derive, and guessing at the transformation is how you
// scan the wrong site quietly.
//
// An address is refused if it carries credentials, since it ends up in a report
// that gets written to a file and printed to a build log.
//
// Naming one of the pair and not the other is its own error rather than a
// silent fall-through, because it is a typo, not a choice.

import { resolve } from "node:path";

import type { IntegrationConfig, ResolvedTarget } from "./types.js";

function httpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  }
  catch {
    throw new Error(`Target URL is not parseable: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Target URL must use http or https");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error("Target URL must not contain credentials");
  }
  return url.toString();
}

function assertAmplifyAppId(value: string): void {
  if (!/^d[a-z0-9]+$/.test(value)) {
    throw new Error("Amplify app ID must match d[a-z0-9]+; use targetUrl for a custom domain");
  }
}

function assertDomainPrefix(value: string): void {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) {
    throw new Error(
      "Amplify branch must already be a valid DNS label; use targetUrl when the console uses a different display-name prefix",
    );
  }
}

export function resolveTarget(
  config: IntegrationConfig,
  cwd: string = process.cwd(),
): ResolvedTarget {
  if (config.targetUrl !== undefined) {
    return {
      kind: "url",
      source: "explicit-url",
      url: httpUrl(config.targetUrl),
    };
  }
  if (config.buildOutput !== undefined) {
    return {
      kind: "build-output",
      source: "build-output",
      path: resolve(cwd, config.buildOutput),
    };
  }
  if (config.amplifyAppId !== undefined && config.amplifyBranch !== undefined) {
    const appId = config.amplifyAppId.toLowerCase();
    const branch = config.amplifyBranch.toLowerCase();
    assertAmplifyAppId(appId);
    assertDomainPrefix(branch);
    return {
      kind: "url",
      source: "amplify-branch",
      url: `https://${branch}.${appId}.amplifyapp.com/`,
    };
  }
  if (config.amplifyAppId !== undefined || config.amplifyBranch !== undefined) {
    throw new Error("Both amplifyAppId and amplifyBranch are required");
  }
  throw new Error(
    "No scan target: configure targetUrl, buildOutput, or an Amplify app ID and branch",
  );
}
