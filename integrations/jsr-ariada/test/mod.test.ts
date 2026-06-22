// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { usage } from '../src/mod.js';

describe('ariada JSR wrapper', () => {
  it('describes the JSR package and keeps scanning delegated to the CLI', () => {
    expect(usage().install).toContain('jsr:@ariada-org/ariada');
    expect(usage().scan).toContain('@ariada-org/cli');
  });
});
