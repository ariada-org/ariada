// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { EVENTS, createAriadaDecorator, findStaticHtmlIssues, registerAriadaPanel, renderPanelHtml } from '../src/index.js';

describe('@ariada-org/storybook-addon', () => {
  it('finds image and button issues in rendered story HTML', () => {
    const findings = findStaticHtmlIssues('button-story', '<img src="/x.png"><button><svg></svg></button>');

    expect(findings.map((finding) => finding.ruleId)).toEqual(['image-alt', 'button-name']);
  });

  it('emits scan results from the preview decorator', async () => {
    const events: Array<{ eventName: string; payload: unknown }> = [];
    const decorator = createAriadaDecorator({
      channel: { emit: (eventName, payload) => events.push({ eventName, payload }) },
    });

    const rendered = await decorator(() => 'story', {
      id: 'avatar--default',
      canvasElement: {
        innerHTML: '<img src="/avatar.png">',
        ownerDocument: { location: { href: 'http://storybook.local/iframe.html' } },
      },
    });

    expect(rendered).toBe('story');
    expect(events[0]?.eventName).toBe(EVENTS.scanCompleted);
  });

  it('registers a panel renderer', () => {
    let html = '';
    registerAriadaPanel(
      {
        register: (_id, callback) =>
          callback({
            add: (_panelId, entry) => {
              html = entry.render();
            },
          }),
      },
      () => ({
        storyId: 'demo',
        url: 'storybook://demo',
        generatedAt: '2026-06-22T00:00:00.000Z',
        findings: [
          {
            id: 'demo:image-alt:1',
            ruleId: 'image-alt',
            severity: 'serious',
            message: 'Image elements need an alt attribute.',
            selector: 'img:nth-of-type(1)',
          },
        ],
      }),
    );

    expect(html).toContain('data-ariada-status="failed"');
    expect(renderPanelHtml(undefined)).toContain('Waiting for the story canvas scan.');
  });
});
