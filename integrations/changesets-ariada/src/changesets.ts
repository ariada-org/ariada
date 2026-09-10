// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/changesets.js` and `dist/changesets.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the body
// is the compiled one. Checked with
// the rebuild check.
//
// A pending change note is a markdown file with front matter, and the front
// matter is what is checked — not the file name. The directory also holds a
// readme and, after a release, files that are no longer notes; counting every
// markdown file would report a release as pending forever.
//
// A missing directory answers with an empty list rather than an error, because a
// project that has not started using change notes has none pending, which is a
// true answer. Any other read failure is raised: not being able to look is not
// the same as looking and finding nothing.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CHANGESET_FRONTMATTER = /^---\s*\n[\s\S]*?\n---(?:\s*\n|\s*$)/;

export async function findPendingChangesets(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name.toLowerCase() !== "readme.md")
    .map((entry) => entry.name)
    .sort();
  const pending: string[] = [];
  for (const candidate of candidates) {
    const body = await readFile(join(directory, candidate), "utf8");
    if (CHANGESET_FRONTMATTER.test(body)) pending.push(candidate);
  }
  return pending;
}
