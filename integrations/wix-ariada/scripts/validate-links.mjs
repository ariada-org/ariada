import { access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  throw new Error("Pass at least one HTML file to validate.");
}

const failures = [];
for (const file of files) {
  const html = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"));
  const links = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const link of links) {
    if (link.startsWith("http") || link.startsWith("mailto:") || link.startsWith("data:") || link.startsWith("#")) {
      continue;
    }
    const target = join(dirname(file), link);
    try {
      const info = await stat(target);
      if (!info.isFile()) failures.push(`${file}: ${link} is not a file`);
    } catch {
      failures.push(`${file}: missing ${link}`);
    }
  }
}

await Promise.all(files.map((file) => access(file)));
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Validated local links for ${files.length} HTML file(s).`);
