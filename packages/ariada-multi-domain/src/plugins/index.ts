// SPDX-License-Identifier: EUPL-1.2
/**
 * Reference jurisdiction plugins shipped with `@ariada-org/multi-domain`.
 *
 * Each plugin is a minimal example of the `JurisdictionPlugin`
 * contract. Plugin authors are encouraged to copy one of these as a
 * starting point and adapt the citation + emission logic for their
 * own jurisdiction.
 */

export { euEaaPlugin, EU_EAA_TOTAL_CRITERIA } from './eu-eaa.js';
export { sePlugin, SE_TOTAL_CRITERIA } from './se.js';
export { dePlugin, DE_TOTAL_CRITERIA } from './de.js';
