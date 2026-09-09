// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/generators/init/generator.js` and its declaration. The
// source this was built from was never committed; the compiled output is `tsc`
// with the types stripped, so the shapes come back from the declaration file
// and the bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// WHAT THIS GENERATOR IS FOR. Adding the scan target by hand means knowing
// where a project's build output lands, and that is exactly what a workspace
// already knows and a person usually does not. So the output path is inferred
// from the build target, and asked for only when it cannot be.
//
// THE TARGET IS CACHEABLE ONLY WHEN IT SCANS A BUILD. A scan of a built
// directory depends on inputs the workspace can see, so replaying it is sound.
// A scan of a live address depends on something outside the workspace entirely,
// and a cache hit there would report yesterday's site as today's.
//
// The browser path is declared as an input for the same reason: change the
// browser and the result may change, so the cache must know about it.
//
// And an existing target is not replaced without being asked. Overwriting a
// target somebody configured, silently, is worse than refusing.

import { readProjectConfiguration, updateProjectConfiguration } from '@nx/devkit';
import type { ProjectConfiguration, Tree } from '@nx/devkit';

import type { InitGeneratorSchema } from './schema.js';

const EXECUTOR = '@ariada-org/nx:a11y';

function inferOutputPath(project: ProjectConfiguration, buildTargetName: string): string | undefined {
  const build = project.targets?.[buildTargetName];
  const configured = build?.options?.['outputPath'];
  if (typeof configured === 'string' && configured.length > 0) return configured;
  const output = build?.outputs?.find((candidate) => candidate.includes('outputPath'));
  return output?.replace(/^\{workspaceRoot\}\//, '').replace('{options.outputPath}', 'dist');
}

export default async function initGenerator(tree: Tree, options: InitGeneratorSchema): Promise<void> {
  if (options.outputPath !== undefined && options.url !== undefined) {
    throw new Error('Configure outputPath or url, not both');
  }
  const project = readProjectConfiguration(tree, options.project);
  const targetName = options.targetName ?? 'a11y';
  if (project.targets?.[targetName] !== undefined && options.force !== true) {
    throw new Error(`Project ${options.project} already has target ${targetName}; use --force to replace it`);
  }
  const buildTarget = options.buildTarget ?? 'build';
  const outputPath =
    options.url === undefined ? options.outputPath ?? inferOutputPath(project, buildTarget) : undefined;
  if (options.url === undefined && outputPath === undefined) {
    throw new Error(`Cannot infer outputPath from ${options.project}:${buildTarget}; pass --outputPath or --url`);
  }
  const reportDir = options.reportDir ?? `.ariada/${options.project}`;
  const executorOptions = {
    reportDir,
    severityThreshold: options.severityThreshold ?? 'moderate',
    timeoutMs: options.timeoutMs ?? 30_000,
    browser: 'chromium',
    ...(options.url === undefined ? { outputPath: outputPath } : { url: options.url }),
    ...(options.allowPrivate === true ? { allowPrivate: true } : {}),
  };
  const target = {
    executor: EXECUTOR,
    cache: options.url === undefined,
    inputs: ['default', '^default', { env: 'PLAYWRIGHT_BROWSERS_PATH' }],
    outputs: ['{options.reportDir}'],
    options: executorOptions,
    ...(options.url === undefined ? { dependsOn: [buildTarget] } : {}),
  };
  project.targets = { ...(project.targets ?? {}), [targetName]: target };
  updateProjectConfiguration(tree, options.project, project);
}
