// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Minimal fixture domain module — used for testing npm-convention discovery
// used for domain-discovery tests. This module follows the
// `ariada-domain-*` naming convention so the domain discovery function can
// find it automatically when scanning workspace packages.

// Types will be exported from @ariada-org/core-engine once the builder lands

import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '@ariada-org/core-engine';

/**
 * A fixture domain that does nothing useful — its only purpose is to be
 * discoverable via the `ariada-domain-*` npm-convention path and appear
 * in the MultiDomainReport grid during acceptance tests.
 */
export const fixtureDomain: DomainModule = {
  id: 'fixture-domain',
  title: 'Fixture Domain (discovery test)',
  version: '0.0.1',

  extractors: {
    perElement(_el: ElementHandle, _acc: FeatureSink): void {
      // No-op: this module only needs to be discoverable, not functional.
    },
    perDocument(_snap: PropertySnapshot, _acc: FeatureSink): void {
      // No-op.
    },
  },

  evaluate(_features: ExtractedFeatures) {
    return [];
  },
};

export default fixtureDomain;
