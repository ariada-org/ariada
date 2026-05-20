// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * `color-contrast` — reference WCAG 2.2 SC 1.4.3 (Contrast — Minimum) analyzer.
 *
 * This is the v0.1 bundled reference implementation that exists to:
 *   1. validate the `DomainAnalyzer` contract end-to-end,
 *   2. give downstream contributors a worked example,
 *   3. provide a minimum-functional default scan when no other a11y analyzer
 *      is registered.
 *
 * Production deployments compose the much richer rule set from
 * `@ariada/wcag-rules-extended` on top of this engine.
 *
 * Algorithm (per WCAG 2.2 §1.4.3 Techniques):
 *   1. For each AX-tree node that has both a computed foreground colour and a
 *      computed background colour (sourced from the adapter — see the
 *      `__contrast` property convention below), compute the relative
 *      luminance via the standard formula.
 *   2. Compute the contrast ratio L1/L2 where L1 is the lighter colour.
 *   3. Compare against the 4.5:1 threshold (3:1 for "large text", treated as
 *      font-size ≥ 18 pt or ≥ 14 pt bold via an adapter-supplied `__large`
 *      flag).
 *   4. Emit a `Finding` with severity `serious` when the threshold is missed.
 *
 * Adapters populate the per-node colour data into the AXNode `properties`
 * array using these property names (kept stable so multiple adapters can
 * cooperate):
 *
 *   - `__fg`     — foreground colour as `"rgb(R,G,B)"` or `"#RRGGBB"`
 *   - `__bg`     — background colour, same encoding
 *   - `__large`  — boolean (`true` if WCAG-large-text threshold applies)
 *
 * Nodes without `__fg` / `__bg` data are skipped silently; this analyzer is
 * intentionally permissive so that snapshots from minimal adapters still run.
 *
 */
import type {
  AnalyzerContext,
  AXNode,
  AXNodeRef,
  DomainAnalyzer,
  Finding,
} from '../types.js';

export const COLOR_CONTRAST_RULE_ID = 'wcag-1.4.3-contrast-minimum';
export const COLOR_CONTRAST_DOMAIN = 'a11y' as const;
export const COLOR_CONTRAST_VERSION = '0.1.0';

/** WCAG 2.2 §1.4.3 thresholds. */
export const NORMAL_TEXT_RATIO = 4.5;
export const LARGE_TEXT_RATIO = 3.0;

/** Parse `"rgb(R,G,B)"` or `"#RRGGBB"` or `"#RGB"` into `[R,G,B]` (0–255). */
export function parseColor(input: string): [number, number, number] | null {
  const s = input.trim().toLowerCase();
  // #RRGGBB
  const hex6 = /^#([0-9a-f]{6})$/.exec(s);
  if (hex6 && hex6[1]) {
    const n = parseInt(hex6[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  // #RGB
  const hex3 = /^#([0-9a-f]{3})$/.exec(s);
  if (hex3 && hex3[1]) {
    const r = parseInt(hex3[1][0]!, 16);
    const g = parseInt(hex3[1][1]!, 16);
    const b = parseInt(hex3[1][2]!, 16);
    return [r * 17, g * 17, b * 17];
  }
  // rgb(R,G,B) / rgba(R,G,B,A)
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

/** WCAG relative-luminance formula (sRGB). */
export function relativeLuminance(rgb: readonly [number, number, number]): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(rgb[0]);
  const g = channel(rgb[1]);
  const b = channel(rgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio per WCAG 2.2: (L1 + 0.05) / (L2 + 0.05) with L1 ≥ L2. */
export function contrastRatio(
  fg: readonly [number, number, number],
  bg: readonly [number, number, number],
): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

interface NodeWithContrast {
  node: AXNode;
  fg: [number, number, number];
  bg: [number, number, number];
  large: boolean;
  text: string;
}

function readContrastInputs(node: AXNode): NodeWithContrast | null {
  const props = node.properties ?? [];
  let fgStr: string | undefined;
  let bgStr: string | undefined;
  let large = false;
  for (const p of props) {
    if (p.name === '__fg' && typeof p.value.value === 'string') fgStr = p.value.value;
    else if (p.name === '__bg' && typeof p.value.value === 'string') bgStr = p.value.value;
    else if (p.name === '__large' && p.value.value === true) large = true;
  }
  if (!fgStr || !bgStr) return null;
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);
  if (!fg || !bg) return null;
  const text =
    typeof node.name?.value === 'string' ? node.name.value : '';
  return { node, fg, bg, large, text };
}

function findingFromNode(scanId: string, n: NodeWithContrast): Finding {
  const ratio = contrastRatio(n.fg, n.bg);
  const threshold = n.large ? LARGE_TEXT_RATIO : NORMAL_TEXT_RATIO;
  const element: AXNodeRef = {
    selector: '',
    ...(n.node.backendDOMNodeId !== undefined && { backendNodeId: n.node.backendDOMNodeId }),
    ...(typeof n.node.role?.value === 'string' && { role: n.node.role.value }),
    ...(n.text && { name: n.text }),
  };
  return {
    id: `${n.node.nodeId}:${COLOR_CONTRAST_RULE_ID}`,
    scanId,
    domain: COLOR_CONTRAST_DOMAIN,
    ruleId: COLOR_CONTRAST_RULE_ID,
    severity: 'serious',
    element,
    message: `Insufficient contrast ratio ${ratio.toFixed(2)}:1 (required ${threshold}:1${n.large ? ' for large text' : ''})`,
    criterion: 'WCAG 2.2 §1.4.3 Contrast (Minimum)',
    wcagMapping: ['1.4.3'],
    regulatoryMapping: [
      { framework: 'WCAG', code: '1.4.3' },
      { framework: 'EN 301 549', code: '9.1.4.3' },
    ],
    confidence: 0.95,
  };
}

/**
 * Factory for the bundled color-contrast analyzer.
 *
 * Returns a `DomainAnalyzer` that walks the AX tree, looks for nodes carrying
 * adapter-supplied `__fg` + `__bg` properties, applies the WCAG SC 1.4.3
 * algorithm, and emits a finding when the threshold is missed.
 */
export function createColorContrastAnalyzer(): DomainAnalyzer {
  return {
    domain: COLOR_CONTRAST_DOMAIN,
    version: COLOR_CONTRAST_VERSION,
    ruleIds: [COLOR_CONTRAST_RULE_ID],
    async analyze(ctx: AnalyzerContext): Promise<Finding[]> {
      const findings: Finding[] = [];
      for (const node of ctx.snapshot.axTree) {
        if (node.ignored) continue;
        const inputs = readContrastInputs(node);
        if (!inputs) continue;
        const ratio = contrastRatio(inputs.fg, inputs.bg);
        const threshold = inputs.large ? LARGE_TEXT_RATIO : NORMAL_TEXT_RATIO;
        if (ratio + 1e-9 < threshold) {
          findings.push(findingFromNode(ctx.snapshot.scanId, inputs));
        }
      }
      return findings;
    },
  };
}

/** Convenience singleton — the default, parameterless analyzer instance. */
export const colorContrastAnalyzer: DomainAnalyzer = createColorContrastAnalyzer();
