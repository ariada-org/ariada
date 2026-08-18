// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What a project wants checked, kept in the project.
//
// Without this, every repository that wants a check has to encode its own
// answers — which directory the build lands in, which pages matter, which
// domains to run — inside whatever calls the scanner. That turns a rule meant
// to be copied unchanged between repositories into a rule that has to be edited
// for each one, and an edited rule drifts.
//
// So the command stays the same everywhere and the answers live in a file
// beside the project's own build. A repository with no file gets defaults that
// suit a static site; a repository with one is checked on its own terms.

import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

/** What a project declares about how it should be checked. */
export interface ProjectConfig {
  /** Directory the build produces, relative to the config file. */
  root: string;
  /** Pages to check, relative to `root`. */
  pages: string[];
  /** Domains to run. Absent means every domain the scanner has. */
  domains?: string[];
  /** Where reports are written, relative to the config file. */
  outputDir: string;
  /** Severity at which the check should be treated as a failure by a caller
   *  that cares. The rule shipped to projects deliberately does not. */
  severityThreshold?: 'minor' | 'moderate' | 'serious' | 'critical' | undefined;
}

/** Files looked for, in order, when none was named. */
export const CONFIG_NAMES = ['ariada.json', '.ariada.json', '.ariadarc.json'];

const DEFAULTS: ProjectConfig = {
  root: '.',
  pages: ['index.html'],
  outputDir: 'ariada-report',
};

/** What went wrong, in words a maintainer can act on. */
export class ProjectConfigError extends Error {
  /**
   *
   */
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ProjectConfigError';
  }
}

function asStringArray(value: unknown, field: string, path: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ProjectConfigError(path, `"${field}" must be a list of strings`);
  }
  if (value.length === 0) {
    throw new ProjectConfigError(path, `"${field}" is empty, so nothing would be checked`);
  }
  return value as string[];
}

/**
 * Read a project's configuration, with the file's own directory as the base for
 * every relative path in it. A path is resolved against the file rather than
 * against the working directory, because the caller's working directory is not
 * something the project controls.
 */
export async function readProjectConfig(path: string): Promise<ProjectConfig & { dir: string }> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new ProjectConfigError(path, 'cannot be read');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ProjectConfigError(path, `is not valid JSON — ${(error as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ProjectConfigError(path, 'must contain a JSON object');
  }

  const dir = dirname(resolve(path));
  const value = raw as Record<string, unknown>;

  const config: ProjectConfig & { dir: string } = {
    dir,
    root: typeof value['root'] === 'string' ? value['root'] : DEFAULTS.root,
    pages: value['pages'] === undefined ? DEFAULTS.pages : asStringArray(value['pages'], 'pages', path),
    outputDir: typeof value['outputDir'] === 'string' ? value['outputDir'] : DEFAULTS.outputDir,
  };

  if (value['domains'] !== undefined) {
    config.domains = asStringArray(value['domains'], 'domains', path);
  }

  const threshold = value['severityThreshold'];
  if (threshold !== undefined) {
    if (
      typeof threshold !== 'string' ||
      !['minor', 'moderate', 'serious', 'critical'].includes(threshold)
    ) {
      throw new ProjectConfigError(
        path,
        '"severityThreshold" must be one of minor, moderate, serious, critical',
      );
    }
    config.severityThreshold = threshold as ProjectConfig['severityThreshold'];
  }

  return config;
}

/** The addresses to check, given a base the pages are served from. */
export function pageUrls(config: Pick<ProjectConfig, 'pages'>, base: string): string[] {
  const origin = base.endsWith('/') ? base : `${base}/`;
  return config.pages.map((page) => new URL(page.replace(/^\/+/u, ''), origin).toString());
}

/** Where the built site sits on disk, for whatever serves it. */
export function siteRoot(config: Pick<ProjectConfig, 'root'> & { dir: string }): string {
  return isAbsolute(config.root) ? config.root : resolve(config.dir, config.root);
}

/** Where reports go. */
export function outputPath(config: Pick<ProjectConfig, 'outputDir'> & { dir: string }): string {
  return isAbsolute(config.outputDir) ? config.outputDir : resolve(config.dir, config.outputDir);
}
