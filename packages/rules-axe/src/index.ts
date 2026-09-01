/**
 * The axe-core analyzer moved into `@ariada-org/core-playwright`, which is the
 * package the scanner loads it from by default. It used to live here, and the
 * scanner imported it across the package boundary at runtime — which worked in
 * this workspace and nowhere else, because this package is not part of the
 * published source tree.
 *
 * Kept as a re-export so anything already installing `@ariada-org/rules-axe`
 * keeps working unchanged.
 */
export {
  createA11yAnalyzer,
  mapAxeImpact,
  type CreateA11yAnalyzerOptions,
} from '@ariada-org/core-playwright';
