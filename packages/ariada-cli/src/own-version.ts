// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The version this build actually is, read from the manifest beside it.
 *
 * It used to be written into the flag by hand, and by the time anybody looked
 * the published tool answered 0.3.0 to `ariada version` and 0.1.0 to
 * `ariada --version`. The flag is the one everyone types and the one every bug
 * report quotes, so the wrong answer was the one that travelled.
 *
 * Read synchronously because the flag is declared while the parser is being
 * built, and an argument parser that has to be awaited before it can describe
 * itself is a worse trade than one blocking read of a file that is already on
 * disk beside the module asking for it.
 */
export function ownVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/own-version.js → ../package.json
    const raw = readFileSync(join(here, '..', 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}
