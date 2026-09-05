// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/adapter.js` and `dist/adapter.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { parseSauceManifest } from './manifest.js';
import { buildReport, writeArtifacts } from './report.js';
import type { RunSauceLabsAriadaOptions, SauceLabsAriadaReport } from './types.js';

/**
 * Run one scan against a remote session.
 *
 * Neither the session nor the scanner is created here — both are handed in.
 * That is what keeps this testable without a remote browser, and it is why the
 * package has no credentials of its own.
 *
 * The session is closed in a `finally`, so a scan that throws still releases
 * the remote machine somebody is paying for by the minute.
 *
 * @param options - the manifest, the session factory, the scanner, where to write
 * @returns the report
 */
export async function runSauceLabsAriada(
  options: RunSauceLabsAriadaOptions,
): Promise<SauceLabsAriadaReport> {
  const manifest = parseSauceManifest(options.manifest);
  const session = await options.sessionFactory.create(manifest);
  try {
    await session.cdp.send('Page.enable');
    await session.cdp.send('Page.navigate', { url: manifest.source.url });
    const scan = await options.scanner.scan({ manifest, session });
    const report = buildReport(manifest, session.id, scan);
    if (options.outputDir) await writeArtifacts(options.outputDir, report);
    return report;
  } finally {
    await session.close();
  }
}
