// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Public types for the Playwright fixture entry. Kept separate from
 * `fixture.ts` so test-only callers can import types without dragging the
 * runtime implementation into their tsc graph.
 */

export type { A11yFixture } from './fixture.js';
