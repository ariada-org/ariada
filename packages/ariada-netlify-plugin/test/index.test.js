// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { internals, runPlugin } from "../src/index.js";

test("safePath blocks traversal outside publish directory", () => {
  const root = "/tmp/site";
  assert.equal(internals.safePath(root, "/index.html"), join(root, "index.html"));
  assert.equal(internals.safePath(root, "/../secret.txt"), null);
});

test("onPostBuild serves publish dir and runs ariada command", async () => {
  const root = await mkdtemp(join(tmpdir(), "ariada-netlify-"));
  const publish = join(root, "public");
  const output = join(root, "out");
  const fakeCli = join(root, "fake-ariada.mjs");
  await import("node:fs/promises").then((fs) => fs.mkdir(publish, { recursive: true }));
  await writeFile(join(publish, "index.html"), "<!doctype html><title>Ariada</title>", "utf8");
  await writeFile(
    fakeCli,
    `
      import { mkdir, writeFile } from "node:fs/promises";
      const outputIndex = process.argv.indexOf("--output-dir");
      const outputDir = process.argv[outputIndex + 1];
      await mkdir(outputDir, { recursive: true });
      await writeFile(outputDir + "/scan.json", JSON.stringify({ summary: { total: 0 }, report: { findings: {} } }));
      process.exit(0);
    `,
    "utf8",
  );

  try {
    const messages = [];
    await runPlugin({
      inputs: { command: `${process.execPath} ${fakeCli}`, outputDir: output },
      constants: { PUBLISH_DIR: publish },
      utils: {
        status: {
          info: (message) => messages.push(message),
          warn: (message) => messages.push(message),
        },
      },
    });
    const scan = JSON.parse(await readFile(join(output, "scan.json"), "utf8"));
    assert.equal(scan.summary.total, 0);
    assert.ok(messages.some((message) => message.includes("scan passed")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("violations call Netlify failBuild when configured", async () => {
  const root = await mkdtemp(join(tmpdir(), "ariada-netlify-"));
  const publish = join(root, "public");
  const output = join(root, "out");
  const fakeCli = join(root, "fake-ariada.mjs");
  await import("node:fs/promises").then((fs) => fs.mkdir(publish, { recursive: true }));
  await writeFile(join(publish, "index.html"), "<!doctype html><title>Ariada</title>", "utf8");
  await writeFile(
    fakeCli,
    `
      import { mkdir, writeFile } from "node:fs/promises";
      const outputDir = process.argv[process.argv.indexOf("--output-dir") + 1];
      await mkdir(outputDir, { recursive: true });
      await writeFile(outputDir + "/scan.json", JSON.stringify({ summary: { total: 1 }, report: { findings: [] } }));
      process.exit(1);
    `,
    "utf8",
  );

  try {
    let failed = "";
    await runPlugin({
      inputs: { command: `${process.execPath} ${fakeCli}`, outputDir: output },
      constants: { PUBLISH_DIR: publish },
      utils: {
        status: { info() {}, warn() {} },
        build: { failBuild: (message) => { failed = message; } },
      },
    });
    assert.match(failed, /accessibility gate found violations/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
