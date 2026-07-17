// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const forbidden = [/\bdebugger\b/, /\bconsole\.log\s*\(/];
const failures = [];

function* jsFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== "node_modules") yield* jsFiles(path);
    } else if (path.endsWith(".js")) {
      yield path;
    }
  }
}

for (const file of jsFiles(".")) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) failures.push(`${file}: ${pattern}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Forbidden debug patterns found:\n${failures.join("\n")}\n`);
  process.exit(1);
}
