import { buildAriadaNpxCommand, buildDenoTaskSnippet } from '@ariada-org/ariada-jsr';

const target = new URL('../fixtures/site/index.html', import.meta.url).href;

const command = buildAriadaNpxCommand({
  target,
  packageVersion: '0.1.0',
  outputDir: './ariada-output',
  domains: ['accessibility', 'security', 'privacy'],
  format: 'both',
  severityThreshold: 'moderate',
});

console.log(command.display);
console.log(buildDenoTaskSnippet({ target, format: 'json' }));
