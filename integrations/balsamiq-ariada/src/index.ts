import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BalsamiqScanConfig {
  exportPath?: string;
  targetUrl?: string;
  outputDir?: string;
  severityThreshold?: string;
  format?: 'json' | 'html' | 'junit';
}

export interface ResolvedBalsamiqTarget {
  kind: 'published-url' | 'html-export';
  target: string;
}

const htmlNames = ['index.html', 'export.html', 'prototype.html'];

export function resolveBalsamiqTarget(config: BalsamiqScanConfig, cwd = process.cwd()): ResolvedBalsamiqTarget {
  if (config.targetUrl) {
    if (!/^https?:\/\/\S+$/u.test(config.targetUrl)) {
      throw new Error('Balsamiq Ariada targetUrl must be an http(s) URL.');
    }
    return { kind: 'published-url', target: config.targetUrl };
  }

  if (!config.exportPath) {
    throw new Error('Balsamiq Ariada requires --target-url or --export-path.');
  }

  const exportPath = resolve(cwd, config.exportPath);
  if (!existsSync(exportPath)) {
    throw new Error(`Balsamiq export path not found: ${exportPath}`);
  }

  const stat = statSync(exportPath);
  if (stat.isFile() && /\.html?$/iu.test(exportPath)) {
    return { kind: 'html-export', target: exportPath };
  }

  if (stat.isDirectory()) {
    for (const name of htmlNames) {
      const candidate = resolve(exportPath, name);
      if (existsSync(candidate)) return { kind: 'html-export', target: candidate };
    }
    const firstHtml = readdirSync(exportPath)
      .filter((name) => /\.html?$/iu.test(name))
      .sort()[0];
    if (firstHtml) return { kind: 'html-export', target: resolve(exportPath, firstHtml) };
  }

  throw new Error(
    'No HTML export found. PNG/PDF-only Balsamiq wireframes are too low-fidelity for automated Ariada scanning; use the manual checklist.',
  );
}

export function buildAriadaCliArgs(config: BalsamiqScanConfig, cwd = process.cwd()): string[] {
  const resolved = resolveBalsamiqTarget(config, cwd);
  const args = [
    'scan',
    resolved.target,
    '--severity-threshold',
    config.severityThreshold ?? 'serious',
    '--format',
    config.format ?? 'json',
  ];

  if (config.outputDir) args.push('--output-dir', config.outputDir);
  return args;
}

export function manualChecklist() {
  return [
    'Confirm reading order before visual polish; map the intended sequence to WCAG 1.3.2 and 2.4.3.',
    'Label every control and placeholder; map intent to WCAG 2.4.6 and 3.3.2 before implementation.',
    'Annotate target-size intent for tappable controls; map to WCAG 2.5.8 before handoff.',
  ];
}
