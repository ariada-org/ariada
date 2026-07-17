import { describe, expect, it } from 'vitest';

import {
  buildAriadaCliArgs,
  buildAriadaNpxCommand,
  buildDenoTaskSnippet,
} from '../src/mod.js';

describe('Ariada JSR adapter', () => {
  it('builds an npx command that delegates scanning to @ariada-org/cli', () => {
    const command = buildAriadaNpxCommand({
      target: 'https://example.test',
      packageVersion: '0.1.0',
      outputDir: './ariada-output',
      domains: ['accessibility', 'privacy'],
      browser: 'chromium',
      format: 'both',
      severityThreshold: 'serious',
      timeoutMs: 12_000,
    });

    expect(command.command).toBe('npx');
    expect(command.args).toEqual([
      '--yes',
      '@ariada-org/cli@0.1.0',
      'scan',
      'https://example.test',
      '--output-dir',
      './ariada-output',
      '--browser',
      'chromium',
      '--format',
      'both',
      '--severity-threshold',
      'serious',
      '--timeout-ms',
      '12000',
      '--domains',
      'accessibility,privacy',
    ]);
    expect(command.display).toContain('@ariada-org/cli@0.1.0 scan');
  });

  it('rejects empty targets before a consumer launches a scan', () => {
    expect(() => buildAriadaCliArgs({ target: '' })).toThrow(
      'Ariada JSR adapter requires a target URL.',
    );
  });

  it('renders a Deno task snippet for JSR consumers', () => {
    const snippet = buildDenoTaskSnippet({
      target: 'https://example.test/docs',
      format: 'json',
      severityThreshold: 'moderate',
    });

    expect(JSON.parse(snippet)).toEqual({
      tasks: {
        'ariada:scan':
          'npx --yes @ariada-org/cli@latest scan https://example.test/docs --format json --severity-threshold moderate',
      },
    });
  });
});
