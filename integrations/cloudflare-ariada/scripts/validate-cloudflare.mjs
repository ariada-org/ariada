// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const toml = await readFile(new URL('../wrangler.example.toml', import.meta.url), 'utf8');
const script = await readFile(new URL('../build-step.sh', import.meta.url), 'utf8');

for (const required of ['name = ', 'main = ', 'compatibility_date = ', 'ARIADA_API_BASE_URL']) {
  if (!toml.includes(required)) {
    throw new Error(`wrangler.example.toml missing ${required}`);
  }
}
for (const required of ['npx @ariada-org/cli scan', 'ARIADA_TARGET_URL', 'ARIADA_FAIL_ON_SEVERITY']) {
  if (!script.includes(required)) {
    throw new Error(`build-step.sh missing ${required}`);
  }
}

console.log('Cloudflare Ariada config OK: Wrangler example and build wrapper shape present.');
