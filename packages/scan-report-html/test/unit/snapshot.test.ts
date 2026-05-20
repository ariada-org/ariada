// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Golden-file snapshot test.
 *
 * Anchors the renderer output to a deterministic byte stream so any
 * unintended regression in layout, ordering, or escaping shows up as a
 * diff during code review. Run `pnpm test -u` to refresh the snapshot
 * after intentional changes — review the diff before committing.
 */

import { describe, expect, it } from 'vitest';

import { renderScanReport } from '../../src/index.js';
import { EMPTY_INPUT, FIXTURE_INPUT } from '../fixtures/findings.js';

describe('renderScanReport — golden snapshot', () => {
  it('matches the snapshot for the empty-input fixture', () => {
    const html = renderScanReport(EMPTY_INPUT);
    expect(html).toMatchSnapshot();
  });

  it('matches the snapshot for the 5-finding fixture', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    expect(html).toMatchSnapshot();
  });
});
