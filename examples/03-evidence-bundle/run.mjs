// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Example: emit a three-format evidence bundle from a fixed list of
// axe-core-shaped violations. The output is intentionally synthetic so
// the example runs offline — in real use the violation list comes from
// a scan (e.g. `ariada scan ... --format json`) and gets fed straight
// into the same three emitters.

import { writeFileSync, mkdirSync } from "node:fs";
import {
  emitVpat,
  emitEn301549,
  emitDosLagen,
} from "@ariada-org/evidence-emitter";

const violations = [
  {
    id: "image-alt",
    impact: "serious",
    tags: ["wcag2a", "wcag111", "section508"],
    description: "Images must have alternate text",
    help: "Image elements must have an alt attribute",
    nodes: [{ target: ["img"], html: "<img src=\"logo.png\">" }],
  },
  {
    id: "label",
    impact: "serious",
    tags: ["wcag2a", "wcag131", "section508"],
    description: "Form elements must have labels",
    help: "Form elements must have an associated label",
    nodes: [
      {
        target: ["input[name='email']"],
        html: "<input type=\"email\" name=\"email\">",
      },
    ],
  },
  {
    id: "color-contrast",
    impact: "serious",
    tags: ["wcag2aa", "wcag143"],
    description: "Elements must have sufficient colour contrast",
    help: "Foreground / background contrast ratio must be at least 4.5:1",
    nodes: [{ target: ["p"], html: "<p style=\"color:#cccccc;...\">..." }],
  },
];

const meta = {
  productName: "Example shop",
  productVersion: "1.0.0",
  evaluatedBy: "Example QA Team",
  evaluatedOn: "2026-05-21",
  contactUrl: "https://example.com/contact",
  notificationUrl: "https://example.com/accessibility/feedback",
  enforcementUrl: "https://www.digg.se/digital-tillganglighet",
};

const outDir = new URL("./out/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const vpat = emitVpat(violations, meta);
const en301549 = emitEn301549(violations, meta);
const dosLagen = emitDosLagen(violations, meta, { jurisdiction: "SE" });

writeFileSync(
  new URL("vpat.json", outDir),
  JSON.stringify(vpat, null, 2),
);
writeFileSync(
  new URL("en301549.json", outDir),
  JSON.stringify(en301549, null, 2),
);
writeFileSync(
  new URL("dos-lagen.json", outDir),
  JSON.stringify(dosLagen, null, 2),
);

console.log(
  `Wrote three evidence reports to ./out/ (${violations.length} input violation${
    violations.length === 1 ? "" : "s"
  }):`,
);
console.log(`  - out/vpat.json       (${vpat.criteria.length} WCAG criteria)`);
console.log(
  `  - out/en301549.json   (${en301549.rows.length} EN 301 549 §11 rows)`,
);
console.log(
  `  - out/dos-lagen.json  (status: ${dosLagen.conformance})`,
);
