// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { resolve } from 'node:path';

import ariadaVite, {
  scanViteOutput,
  type AriadaViteOptions,
  type Severity,
  type VitePluginLike,
  type ViteScanReport,
} from '@ariada-org/vite-plugin';

export interface AriadaSolidStartOptions {
  outDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export function ariadaSolidStart(options: AriadaSolidStartOptions = {}): VitePluginLike {
  const viteOptions: AriadaViteOptions = {
    outDir: options.outDir ?? '.output/public',
    reportFile: options.reportFile ?? 'ariada-solidstart-report.json',
  };
  if (options.failOn !== undefined) viteOptions.failOn = options.failOn;
  return ariadaVite(viteOptions);
}

export async function scanSolidStartOutput(
  projectRoot = process.cwd(),
  options: Pick<AriadaSolidStartOptions, 'outDir'> = {},
): Promise<ViteScanReport> {
  return scanViteOutput(resolve(projectRoot, options.outDir ?? '.output/public'));
}

export default ariadaSolidStart;
