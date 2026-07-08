import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [pkg, recipe, readme] = await Promise.all([
  readJson(new URL('package.json', root)),
  readJson(new URL('recipe.json', root)),
  readFile(new URL('README.md', root), 'utf8'),
]);

function readJson(url) {
  return readFile(url, 'utf8').then((text) => JSON.parse(text));
}

if (pkg.name !== '@ariada-integrations/balsamiq-ariada') {
  throw new Error('package name must remain the Balsamiq integration package');
}
if (recipe.scanner !== '@ariada-org/cli') {
  throw new Error('recipe must invoke @ariada-org/cli');
}
for (const input of ['html-export-directory', 'html-file', 'published-http-url']) {
  if (!recipe.supportedInputs.includes(input)) throw new Error(`recipe missing supported input: ${input}`);
}
for (const phrase of ['low-fidelity', 'no Balsamiq plugin marketplace', '@ariada-org/cli']) {
  if (!readme.includes(phrase)) throw new Error(`README missing required phrase: ${phrase}`);
}

console.log('PASS balsamiq-ariada recipe');
