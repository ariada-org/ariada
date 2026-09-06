// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/usages.js` and `dist/usages.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// A COMPONENT NEEDS MARKUP BEFORE IT CAN BE SCANNED, AND THERE ARE THREE PLACES
// TO GET IT — in falling order of how much the author meant it: markup written
// into the configuration, markup from the component's own usage documentation,
// or the empty element by itself. The source of each is recorded in the report,
// because an empty element usually renders nothing worth judging and a reader
// should be able to tell that from a real usage without opening the fixture.
//
// The documentation is read as fenced code blocks, with a fallback to the whole
// document when it contains markup but no fence. Usage docs are written for
// people and both shapes are common; taking only the fenced form would silently
// scan the empty element for half the library.
//
// THE HARNESS WAITS FOR THE COMPONENT RATHER THAN FOR THE PAGE. A custom element
// is defined asynchronously and renders asynchronously after that, so it waits
// for the definition, then for the element's own readiness, and only then marks
// the document ready. Scanning before that reports an empty shell as accessible.
//
// A base element is added when the page has none, so a relative asset inside a
// usage resolves the way it would on the real site rather than against whatever
// path the harness was served from.

import type { JsonDocs } from '@stencil/core/internal';

import { assertTag } from './config.js';
import type { ComponentUsage, NormalizedStencilAriadaOptions } from './types.js';

export function collectComponentUsages(
  docs: JsonDocs,
  buildTags: readonly string[],
  options: NormalizedStencilAriadaOptions,
): ComponentUsage[] {
  const docsByTag = new Map(docs.components.map((component) => [component.tag, component]));
  const tags = new Set([...buildTags, ...docs.components.map((component) => component.tag)]);
  const selected = [...tags]
    .sort()
    .filter((tag) => options.include.length === 0 || options.include.includes(tag))
    .filter((tag) => !options.exclude.includes(tag));
  return selected.map((tag) => {
    assertTag(tag);
    const component = docsByTag.get(tag);
    const explicit = options.usages[tag];
    if (explicit !== undefined) {
      return { tag, html: explicit, source: 'config', encapsulation: component?.encapsulation ?? 'unknown' };
    }
    const usageEntries = Object.entries(component?.usage ?? {}).sort(([left], [right]) => left.localeCompare(right));
    const rendered = usageEntries
      .flatMap(([name, markdown]) => extractHtml(markdown).map((html) => ({ name, html })))
      .filter((entry) => entry.html.trim().length > 0);
    if (rendered.length > 0) {
      return {
        tag,
        html: rendered.map((entry) => entry.html).join('\n'),
        source: `docs:${[...new Set(rendered.map((entry) => entry.name))].join(',')}`,
        encapsulation: component?.encapsulation ?? 'unknown',
      };
    }
    return {
      tag,
      html: `<${tag}></${tag}>`,
      source: 'generated',
      encapsulation: component?.encapsulation ?? 'unknown',
    };
  });
}

export function extractHtml(markdown: string): string[] {
  const blocks: string[] = [];
  const fenced = /```(?:html|markup)?\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = fenced.exec(markdown)) !== null) {
    const value = match[1]?.trim();
    if (value !== undefined && value.length > 0) blocks.push(value);
  }
  if (blocks.length === 0 && /<[a-z][^>]*>/i.test(markdown)) blocks.push(markdown.trim());
  return blocks;
}

export function renderHarness(indexHtml: string, usage: ComponentUsage): string {
  if (!/<head(?:\s[^>]*)?>/i.test(indexHtml) || !/<body(?:\s[^>]*)?>[\s\S]*<\/body>/i.test(indexHtml)) {
    throw new Error('Stencil www index.html must contain head and body elements');
  }
  const baseReady = /<base\s/i.test(indexHtml)
    ? indexHtml
    : indexHtml.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n    <base href="/">`);
  const readiness = `<script type="module">
    const tag = ${JSON.stringify(usage.tag)};
    await customElements.whenDefined(tag);
    const element = document.querySelector(tag);
    if (element && typeof element.componentOnReady === 'function') await element.componentOnReady();
    document.documentElement.dataset.ariadaReady = 'true';
  </script>`;
  const body = `<body data-ariada-component="${usage.tag}">
    <main>${usage.html}</main>
    ${readiness}
  </body>`;
  return baseReady.replace(/<body(?:\s[^>]*)?>[\s\S]*<\/body>/i, body);
}
