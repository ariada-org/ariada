// SPDX-License-Identifier: EUPL-1.2
/**
 * Vendor signature registry aggregator.
 *
 * Each module under `signatures/<vendor>.ts` exports a default
 * `VendorSignature`. The registry is a frozen array — adding a
 * vendor is a semver-minor bump; changing the report schema is a
 * semver-major bump.
 */

import type { VendorSignature } from '../types.js';

import accessibeIframe from './accessibe-iframe.js';
import accessibe from './accessibe.js';
import audioeye from './audioeye.js';
import equalweb from './equalweb.js';
import faciliti from './faciliti.js';
import genericToolbar from './generic-toolbar.js';
import maxaccess from './maxaccess.js';
import purpleLens from './purple-lens.js';
import reciteme from './reciteme.js';
import userway from './userway.js';

export const REGISTRY: readonly VendorSignature[] = Object.freeze([
  accessibe,
  userway,
  equalweb,
  audioeye,
  reciteme,
  maxaccess,
  accessibeIframe,
  faciliti,
  purpleLens,
  genericToolbar,
]);

/**
 * Set of valid vendor ids — used for fast `signatureSubset` validation.
 */
export const VENDOR_IDS: ReadonlySet<string> = new Set(REGISTRY.map((v) => v.id));
