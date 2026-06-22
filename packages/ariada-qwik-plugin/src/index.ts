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

export interface AriadaQwikOptions {
  outDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export function ariadaQwik(options: AriadaQwikOptions = {}): VitePluginLike {
  const viteOptions: AriadaViteOptions = {
    outDir: options.outDir ?? 'dist',
    reportFile: options.reportFile ?? 'ariada-qwik-report.json',
  };
  if (options.failOn !== undefined) viteOptions.failOn = options.failOn;
  return ariadaVite(viteOptions);
}

export async function scanQwikOutput(
  projectRoot = process.cwd(),
  options: Pick<AriadaQwikOptions, 'outDir'> = {},
): Promise<ViteScanReport> {
  return scanViteOutput(resolve(projectRoot, options.outDir ?? 'dist'));
}

export default ariadaQwik;
