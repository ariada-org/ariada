import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  RELEASE_MANIFEST_RELATIVE_PATH,
  createContentReleaseManifest,
  parseContentReleaseManifestBytes,
  serializeContentReleaseManifest,
  validateDistAgainstContentManifest,
  validateReleaseTarGzip,
} from "./wiki-rc-content-manifest.mjs";

const RELEASE_SHA = "2".repeat(40);
const GENERATED_AT = "2026-06-30T20:00:00.000Z";

async function distFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ariada-wiki-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = join(root, "dist");
  const copy = join(root, "release-manifest.json");
  await mkdir(join(dist, "assets"), { recursive: true });
  await mkdir(join(dist, "guide"), { recursive: true });
  await writeFile(join(dist, "index.html"), "<!doctype html><title>Wiki</title>\n");
  await writeFile(join(dist, "guide", "index.html"), "<!doctype html><title>Guide</title>\n");
  await writeFile(join(dist, "assets", "app.js"), "console.log('wiki');\n");
  await writeFile(join(dist, "_headers"), "/*\n  X-Frame-Options: DENY\n");
  await writeFile(join(dist, "_redirects"), "/old /guide/ 301\n");
  const result = await createContentReleaseManifest({
    distDirectory: dist,
    releaseSha: RELEASE_SHA,
    generatedAt: GENERATED_AT,
    copyPath: copy,
  });
  return { root, dist, copy, result };
}

function writeOctal(header, offset, length, value) {
  const text = `${value.toString(8).padStart(length - 1, "0")}\0`;
  header.write(text, offset, length, "ascii");
}

function ustarGzip(entries) {
  const blocks = [];
  for (const { path, bytes: sourceBytes } of entries) {
    const bytes = Buffer.from(sourceBytes);
    assert.ok(Buffer.byteLength(path) <= 100, "test tar path must fit USTAR name field");
    const header = Buffer.alloc(512);
    header.write(path, 0, 100, "utf8");
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, bytes.length);
    writeOctal(header, 136, 12, 0);
    header.fill(32, 148, 156);
    header[156] = "0".charCodeAt(0);
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    let checksum = 0;
    for (const byte of header) checksum += byte;
    header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
    blocks.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9, mtime: 0 });
}

async function tarEntries(dist, manifest) {
  const entries = [];
  for (const file of manifest.files) entries.push({ path: file.path, bytes: await readFile(join(dist, ...file.path.split("/"))) });
  entries.push({ path: RELEASE_MANIFEST_RELATIVE_PATH, bytes: await readFile(join(dist, ...RELEASE_MANIFEST_RELATIVE_PATH.split("/"))) });
  entries.push({ path: "_headers", bytes: await readFile(join(dist, "_headers")) });
  return entries;
}

test("manifest generation is deterministic, sorted, canonical, and excludes Cloudflare controls", async (t) => {
  const { dist, copy, result } = await distFixture(t);
  assert.equal(result.manifest.releaseSha, RELEASE_SHA);
  assert.equal(result.manifest.generatedAt, GENERATED_AT);
  assert.deepEqual(result.manifest.files.map(({ path }) => path), ["assets/app.js", "guide/index.html", "index.html"]);
  assert.deepEqual(result.manifest.files.map(({ url }) => url), [
    "/assets/app.js",
    "/guide/",
    "/",
  ]);
  const deployed = await readFile(join(dist, ...RELEASE_MANIFEST_RELATIVE_PATH.split("/")));
  const detached = await readFile(copy);
  assert.deepEqual(deployed, detached);
  assert.deepEqual(deployed, serializeContentReleaseManifest(result.manifest));
  const second = await createContentReleaseManifest({ distDirectory: dist, releaseSha: RELEASE_SHA, generatedAt: GENERATED_AT, copyPath: copy });
  assert.deepEqual(second.bytes, result.bytes);
  await validateDistAgainstContentManifest({ distDirectory: dist, manifestBytes: detached });
});

test("dist validation rejects one wrong file and one missing file", async (t) => {
  const wrong = await distFixture(t);
  await writeFile(join(wrong.dist, "assets", "app.js"), "console.log('tampered');\n");
  await assert.rejects(validateDistAgainstContentManifest({ distDirectory: wrong.dist, manifestBytes: wrong.result.bytes }), /exact bytes and hash/u);

  const missing = await distFixture(t);
  await unlink(join(missing.dist, "guide", "index.html"));
  await assert.rejects(validateDistAgainstContentManifest({ distDirectory: missing.dist, manifestBytes: missing.result.bytes }), /is missing/u);
});

test("canonical manifest parsing rejects modified content identities and bytes", async (t) => {
  const { result } = await distFixture(t);
  const wrongContentSet = Buffer.from(`${JSON.stringify({
    ...result.manifest,
    files: result.manifest.files.map((file, index) => index === 0 ? { ...file, bytes: file.bytes + 1 } : file),
    contentSetSha256: result.manifest.contentSetSha256,
  })}\n`);
  assert.throws(() => parseContentReleaseManifestBytes(wrongContentSet, { releaseSha: RELEASE_SHA }), /contentSetSha256/u);
  assert.throws(() => parseContentReleaseManifestBytes(Buffer.concat([result.bytes, Buffer.from("\n")]), { releaseSha: RELEASE_SHA }), /canonical/u);
});

test("final tar must contain the exact manifest and every exact attested file", async (t) => {
  const { dist, result } = await distFixture(t);
  const entries = await tarEntries(dist, result.manifest);
  assert.equal(validateReleaseTarGzip({ tarBytes: ustarGzip(entries), manifestBytes: result.bytes, releaseSha: RELEASE_SHA }).manifest.contentSetSha256, result.manifest.contentSetSha256);

  const wrongFile = entries.map((entry) => entry.path === "assets/app.js" ? { ...entry, bytes: Buffer.from("tampered\n") } : entry);
  assert.throws(() => validateReleaseTarGzip({ tarBytes: ustarGzip(wrongFile), manifestBytes: result.bytes, releaseSha: RELEASE_SHA }), /exact bytes and hash/u);

  const missingFile = entries.filter((entry) => entry.path !== "guide/index.html");
  assert.throws(() => validateReleaseTarGzip({ tarBytes: ustarGzip(missingFile), manifestBytes: result.bytes, releaseSha: RELEASE_SHA }), /missing manifest-listed file/u);

  const modifiedManifest = entries.map((entry) => entry.path === RELEASE_MANIFEST_RELATIVE_PATH ? { ...entry, bytes: Buffer.concat([entry.bytes, Buffer.from(" ")]) } : entry);
  assert.throws(() => validateReleaseTarGzip({ tarBytes: ustarGzip(modifiedManifest), manifestBytes: result.bytes, releaseSha: RELEASE_SHA }), /manifest bytes differ/u);
});
