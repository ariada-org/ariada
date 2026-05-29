// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Mocha + Chai entry. Exports the `ariadaChai` plugin so consumers wire it
 * up explicitly via `chai.use(ariadaChai)` in their test bootstrap.
 *
 * ```ts
 * import chai from 'chai';
 * import { ariadaChai } from '@ariada-org/test-adapters/mocha-chai';
 *
 * chai.use(ariadaChai);
 * ```
 */

export { ariadaChai } from './plugin.js';
import './types.js';
