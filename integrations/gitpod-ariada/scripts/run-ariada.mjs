#!/usr/bin/env node
export function buildGitpodScanArgs(target) {
  const url = target && target.startsWith('http') ? target : 'http://localhost:3000';
  return ['scan', url, '--format', 'json'];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(['ariada', ...buildGitpodScanArgs(process.argv[2])].join(' '));
}
