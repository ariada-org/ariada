// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export type SeverityThreshold = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AriadaNextraOptions {
  exportDir?: string;
  outputDir?: string;
  domains?: readonly string[];
  failOn?: SeverityThreshold | false;
}

export interface NextConfigLike {
  output?: string;
  images?: {
    unoptimized?: boolean;
    [key: string]: unknown;
  };
  ariada?: AriadaNextraOptions;
  [key: string]: unknown;
}

export interface NextraAriadaConfig extends NextConfigLike {
  output: string;
  images: {
    unoptimized: boolean;
    [key: string]: unknown;
  };
  ariada: AriadaNextraOptions;
}

export function withAriadaNextra<TConfig extends NextConfigLike>(
  nextConfig: TConfig = {} as TConfig,
  options: AriadaNextraOptions = {},
): TConfig & NextraAriadaConfig {
  const ariada = {
    exportDir: options.exportDir ?? 'out',
    outputDir: options.outputDir ?? 'ariada-output',
    domains: options.domains ?? ['accessibility'],
    failOn: options.failOn ?? 'serious',
  };

  return {
    ...nextConfig,
    output: nextConfig.output ?? 'export',
    images: {
      ...nextConfig.images,
      unoptimized: nextConfig.images?.unoptimized ?? true,
    },
    ariada,
  } as TConfig & NextraAriadaConfig;
}

export function buildAriadaCliArgs(url: string, options: AriadaNextraOptions = {}): string[] {
  const args = [
    'scan',
    url,
    '--domains',
    (options.domains ?? ['accessibility']).join(','),
    '--format',
    'both',
    '--output-dir',
    options.outputDir ?? 'ariada-output',
  ];
  if (options.failOn !== false) {
    args.push('--severity-threshold', options.failOn ?? 'serious');
  }
  return args;
}
