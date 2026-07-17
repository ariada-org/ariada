// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import test from 'node:test';

import { usage } from '../dist/src/mod.js';

test('describes the JSR package and keeps scanning delegated to the CLI', () => {
  assert.match(usage().install, /jsr:@ariada-org\/ariada/u);
  assert.match(usage().scan, /@ariada-org\/cli/u);
});
