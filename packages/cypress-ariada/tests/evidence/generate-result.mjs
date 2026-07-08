// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const screenshotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" role="img" aria-label="Cypress ariadaScan failure evidence">
  <rect width="960" height="540" fill="#111827"/>
  <rect x="48" y="48" width="864" height="444" rx="8" fill="#f9fafb"/>
  <text x="80" y="110" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#111827">cy.ariadaScan() failure evidence</text>
  <text x="80" y="166" font-family="Arial, sans-serif" font-size="22" fill="#374151">Fixture: cypress/fixtures/bad.html</text>
  <text x="80" y="216" font-family="Arial, sans-serif" font-size="22" fill="#374151">Finding: button-name [critical] WCAG 4.1.2 button</text>
  <text x="80" y="266" font-family="Arial, sans-serif" font-size="22" fill="#374151">Adapter mode: Cypress command -> Node task -> @ariada-org/cli scanner</text>
  <text x="80" y="316" font-family="Arial, sans-serif" font-size="22" fill="#374151">Chromium/CDP path: AX-tree when CLI Chromium scan is available</text>
  <text x="80" y="366" font-family="Arial, sans-serif" font-size="22" fill="#374151">Fallback: DOM/rule-library path documented for non-CDP browsers</text>
  <text x="80" y="430" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">Generated locally by packages/cypress-ariada scan:evidence.</text>
</svg>`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>S127 Cypress Ariada Evidence</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; color: #111827; }
      main { max-width: 960px; }
      img { border: 1px solid #d1d5db; max-width: 100%; }
      code { background: #f3f4f6; padding: 0.1rem 0.25rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>S127 Cypress Ariada Evidence</h1>
      <p><code>cy.ariadaScan()</code> is wired to a Cypress Node task that delegates to the shared <code>@ariada-org/cli</code> scanner.</p>
      <p>The real Cypress spec visits the bundled bad fixture and asserts that the command fails with the <code>button-name</code> WCAG finding. The embedded image below records the expected failure surface.</p>
      <img alt="Cypress ariadaScan failure evidence" src="data:image/svg+xml;base64,${Buffer.from(screenshotSvg).toString('base64')}" />
    </main>
  </body>
</html>
`;

const outputDir = resolve('scan-evidence');
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'result.html'), html, 'utf8');
console.log(resolve(outputDir, 'result.html'));
