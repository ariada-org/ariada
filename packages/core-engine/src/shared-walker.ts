// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  JoinScope,
  PropertySnapshot,
  SiteContext,
} from './domain-contract.js';

/**
 * Result of one shared pass. `features` holds every domain's per-element and
 * per-document features; `traversalCount` is the number of DOM traversals
 * performed — it MUST stay 1 no matter how many domains are registered. A single
 * shared pass is O(n) in DOM size regardless of how many domains run.
 */
export interface SharedWalkerResult {
  features: ExtractedFeatures;
  traversalCount: number;
}

/**
 *
 */
export interface SharedWalkerOptions {
  snapshot: PropertySnapshot;
  domains: readonly DomainModule[];
}

/**
 * Run the one shared walker over a captured snapshot. Each element in the
 * snapshot outline is visited exactly once; during that single visit every
 * applicable domain's `perElement` extractor runs. After the traversal, each
 * applicable domain's `perDocument` extractor runs once. Adding a domain adds
 * zero extra traversals — the cost is O(elements), not O(elements x domains).
 */
export async function createSharedWalker(
  opts: SharedWalkerOptions,
): Promise<SharedWalkerResult> {
  const { snapshot, domains } = opts;
  const features: ExtractedFeatures = {
    byElement: new Map(),
    byDocument: new Map(),
    byScope: new Map(),
  };

  const origin = safeOrigin(snapshot.url);
  const ctx: SiteContext = { url: snapshot.url, origin, snapshot };

  // Resolve applicability up front so an inapplicable domain contributes nothing
  // — neither per-element nor per-document features.
  const applicable: DomainModule[] = [];
  for (const domain of domains) {
    if (domain.applicability) {
      const ok = await domain.applicability(ctx);
      if (!ok) continue;
    }
    applicable.push(domain);
  }

  let traversalCount = 0;

  // The ONE shared traversal. Every applicable domain's perElement runs inside
  // this single loop — there is no per-domain traversal.
  if (applicable.some((d) => d.extractors.perElement)) {
    traversalCount = 1;
    for (const entry of snapshot.domOutline) {
      const el: ElementHandle = {
        backendNodeId: entry.backendNodeId,
        nodeName: entry.nodeName,
        selector: entry.selector,
        ...(entry.frameId !== undefined ? { frameId: entry.frameId } : {}),
      };
      for (const domain of applicable) {
        const perElement = domain.extractors.perElement;
        if (!perElement) continue;
        perElement(el, elementSink(features, domain.id));
      }
    }
  } else {
    // No element extractors at all still counts as one (empty) pass over the DOM.
    traversalCount = 1;
  }

  // Document-level extractors run once each, after the element traversal.
  for (const domain of applicable) {
    const perDocument = domain.extractors.perDocument;
    if (!perDocument) continue;
    perDocument(snapshot, documentSink(features, domain.id));
  }

  return { features, traversalCount };
}

/**
 * A sink that attributes element-level features to `byElement[elementKey]` under
 * the given domain id, so two domains writing to the same element key can later
 * be correlated by the cross-domain detector. Every element feature also lands in
 * the generic `byScope` index under the `element` scope, with the element key as
 * the join value.
 */
function elementSink(features: ExtractedFeatures, domainId: string): FeatureSink {
  return {
    set(elementKey: string, featureKey: string, value: unknown): void {
      let bucket = features.byElement.get(elementKey);
      if (!bucket) {
        bucket = { domainFeatures: {} };
        features.byElement.set(elementKey, bucket);
      }
      let domainMap = bucket.domainFeatures[domainId];
      if (!domainMap) {
        domainMap = new Map();
        bucket.domainFeatures[domainId] = domainMap;
      }
      domainMap.set(featureKey, value);
      pushScoped(features, 'element', elementKey, { domainId, featureKey, value });
    },
    setScoped(scope: JoinScope, joinValue: string, featureKey: string, value: unknown): void {
      pushScoped(features, scope, joinValue, { domainId, featureKey, value });
    },
  };
}

/**
 * A sink for document-level features. The element-key argument is recorded as
 * part of the feature key so distinct document features stay separable, while a
 * plain document feature can be set with an empty element key. Features are also
 * indexed in `byScope` so they can be correlated on their declared join scope.
 */
function documentSink(features: ExtractedFeatures, domainId: string): FeatureSink {
  return {
    set(elementKey: string, featureKey: string, value: unknown): void {
      const key = elementKey ? `${elementKey}::${featureKey}` : featureKey;
      features.byDocument.set(key, value);
      pushScoped(features, 'document', elementKey || featureKey, { domainId, featureKey, value });
    },
    setScoped(scope: JoinScope, joinValue: string, featureKey: string, value: unknown): void {
      pushScoped(features, scope, joinValue, { domainId, featureKey, value });
    },
  };
}

/**
 * Append a feature to the generic correlation index, keyed by join scope then by
 * join value.
 */
function pushScoped(
  features: ExtractedFeatures,
  scope: JoinScope,
  joinValue: string,
  feature: { domainId: string; featureKey: string; value: unknown },
): void {
  const byScope = (features.byScope ??= new Map());
  let byValue = byScope.get(scope);
  if (!byValue) {
    byValue = new Map();
    byScope.set(scope, byValue);
  }
  let list = byValue.get(joinValue);
  if (!list) {
    list = [];
    byValue.set(joinValue, list);
  }
  list.push({ ...feature, scope, joinValue });
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
