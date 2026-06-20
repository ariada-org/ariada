// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Minimal sandboxed domain module fixture for testing the local-file loading path.
// This file is loaded inside a sandboxed iframe (no chrome.* access, no DOM access).
// It communicates with the extension host via postMessage using the bridge protocol.
//
// Rule: report one finding for every <img> element that has no alt attribute.
// This mirrors the real accessibility image-alt rule but is self-contained and
// deterministic — useful for verifying the sandbox integration without depending
// on the full engine.

(function () {
  'use strict';

  // Track image elements that are missing alt text.
  var missingAltCount = 0;
  var findings = [];
  var visitedNodeIds = [];

  // Listen for messages from the extension bridge.
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || typeof msg.kind !== 'string') return;

    switch (msg.kind) {
      case 'visit_document':
        // Reset state for each new document.
        missingAltCount = 0;
        findings = [];
        visitedNodeIds = [];
        window.parent.postMessage({ kind: 'ready' }, '*');
        break;

      case 'visit_element': {
        var el = msg.elementData;
        if (!el) break;
        // Check for IMG elements without an alt attribute.
        if (
          el.nodeName === 'IMG' &&
          (el.attributes['alt'] === undefined || el.attributes['alt'] === null)
        ) {
          missingAltCount += 1;
          visitedNodeIds.push(el.backendNodeId);
          findings.push({
            id: 'stub-img-alt-' + el.backendNodeId,
            scanId: 'stub',
            domain: 'stub-a11y',
            ruleId: 'stub/image-alt',
            severity: 'serious',
            element: { selector: el.selector },
            message: 'Image is missing alt text (sandbox stub finding)',
          });
        }
        // Always respond with element_features (even if empty).
        window.parent.postMessage(
          {
            kind: 'element_features',
            features: missingAltCount > 0 ? { 'stub-a11y': { missingAltCount: missingAltCount } } : {},
          },
          '*',
        );
        break;
      }

      case 'evaluate':
        // Return the accumulated findings.
        window.parent.postMessage({ kind: 'findings', findings: findings }, '*');
        break;

      case 'reset':
        missingAltCount = 0;
        findings = [];
        visitedNodeIds = [];
        break;

      default:
        break;
    }
  });

  // Signal that the module is loaded and ready.
  window.parent.postMessage({ kind: 'ready' }, '*');
})();
