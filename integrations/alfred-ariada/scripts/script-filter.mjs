#!/usr/bin/env node
export function buildScanArgs(query) {
  if (!/^https?:\/\/\S+$/iu.test(query)) {
    return null;
  }
  return ['scan', query, '--format', 'json'];
}

export function toAlfredItems(result) {
  const items = result.violations.length === 0
    ? [{ title: `PASS ${result.url}`, subtitle: 'No violations found', arg: result.reportUrl ?? result.url }]
    : result.violations.slice(0, 5).map((violation) => ({
        title: `${violation.impact.toUpperCase()} ${violation.id}`,
        subtitle: violation.description,
        arg: result.reportUrl ?? result.url
      }));
  return { items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = buildScanArgs(process.argv[2] ?? '');
  const output = args
    ? { items: [{ title: `Run ariada ${args.join(' ')}`, arg: args.join(' ') }] }
    : { items: [{ title: 'Enter an http or https URL', valid: false }] };
  console.log(JSON.stringify(output));
}
