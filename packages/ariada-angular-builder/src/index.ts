// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  scanViteOutput,
  type Severity,
  type ViteScanReport,
} from '@ariada-org/vite-plugin';

export interface AngularAriadaBuilderOptions {
  workspaceRoot?: string;
  outputPath: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export interface AngularAriadaBuilderResult {
  success: boolean;
  report: ViteScanReport;
}

export interface AngularWorkspaceProject {
  architect?: Record<string, unknown>;
  targets?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AngularWorkspace {
  projects: Record<string, AngularWorkspaceProject>;
  [key: string]: unknown;
}

export async function runAngularAriadaBuilder(
  options: AngularAriadaBuilderOptions,
): Promise<AngularAriadaBuilderResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const outputPath = resolve(workspaceRoot, options.outputPath);
  const report = await scanViteOutput(outputPath);
  const reportPath = resolve(workspaceRoot, options.reportFile ?? 'ariada-angular-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const failed = options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious');
  return { success: !failed, report };
}

function hasFindingAtOrAbove(report: ViteScanReport, threshold: Severity): boolean {
  const rank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return report.pages.some((page) =>
    page.findings.some((finding) => rank[finding.severity] >= rank[threshold]),
  );
}

export function addAriadaTarget(
  workspace: AngularWorkspace,
  projectName: string,
  options: Partial<AngularAriadaBuilderOptions> = {},
): AngularWorkspace {
  const project = workspace.projects[projectName];
  if (!project) throw new Error(`Angular project "${projectName}" was not found.`);

  const targets = { ...(project.targets ?? project.architect ?? {}) };
  targets['ariada'] = {
    builder: '@ariada-org/angular-builder:scan',
    options: {
      outputPath: options.outputPath ?? `dist/${projectName}`,
      reportFile: options.reportFile ?? 'ariada-angular-report.json',
      failOn: options.failOn ?? 'serious',
    },
  };

  return {
    ...workspace,
    projects: {
      ...workspace.projects,
      [projectName]: {
        ...project,
        targets,
      },
    },
  };
}
