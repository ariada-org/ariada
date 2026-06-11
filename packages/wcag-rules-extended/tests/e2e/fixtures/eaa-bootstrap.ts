// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Browser-side bootstrap module — bundled by esbuild and injected into the
 * page after axe-core has loaded. Registers all @ariada EAA rules and
 * checks via `axe.configure({ rules, checks })`.
 *
 * This module is NEVER imported from Node — only bundled into a string and
 * shipped to the page realm. Importing it from Node would still work
 * (it's pure ESM TypeScript), but the side-effects of touching `window.axe`
 * are obviously browser-only.
 *
 * Author: MENDELEEV (Claude Opus 4.7), 2026-05-17.
 */

import { allRules, allChecks } from '../../../src/index.js';

// Strip the typed `RuleMetadata` (with wcag[], en301549[], etc.) down to
// the slimmed-down `{description, help, helpUrl}` shape axe-core actually
// reads. axe-core silently ignores the extra fields, but explicitly only
// the documented subset avoids future-proofing risk.
function axeFriendlyRuleMetadata(m: { description: string; help: string; helpUrl: string }) {
  return {
    description: m.description,
    help: m.help,
    helpUrl: m.helpUrl,
  };
}

const rules = allRules.map((r) => ({
  id: r.id,
  selector: r.selector,
  matches: r.matches, // axe accepts a function reference here — fine within the bundled IIFE
  any: r.any,
  all: r.all,
  none: r.none,
  tags: r.tags,
  metadata: axeFriendlyRuleMetadata(r.metadata),
  enabled: true,
}));

const checks = allChecks.map((c) => ({
  id: c.id,
  evaluate: c.evaluate, // bundled with closure intact
  metadata: c.metadata,
}));

// Register on the page's axe instance. The bundler will emit a single
// self-contained IIFE; this side effect runs as soon as the script tag
// finishes evaluating.
 
const w = window as any;
if (!w.axe) {
  throw new Error('@ariada eaa-bootstrap: axe-core must be loaded before this script runs');
}
w.axe.configure({ rules, checks });

// Stash the rule IDs so the runner side can request them by name.
w.__ariadaEaaRuleIds = allRules.map((r) => r.id);
