// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { defaultHtmlScanner } from './scan.js';

describe('label text that contains markup', () => {
  it('does not carry attribute fragments into the reported text', async () => {
    // Ending a tag at the first `>` cuts inside a quoted attribute, leaving
    // `b">` behind as if it were part of the label. A finding then quoted
    // nonsense back at the reader.
    const html =
      '<label for="x"><img alt="a > b" src="/i.png">Accept terms</label><input id="x">';
    const { findings } = await defaultHtmlScanner({ filePath: 'demo.html', html });
    const leaked = findings.some((f) => /b"\s*>/.test(JSON.stringify(f)));
    expect(leaked).toBe(false);
  });
});
