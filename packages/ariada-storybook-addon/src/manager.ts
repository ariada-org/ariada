// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { ADDON_ID, PANEL_ID } from './constants.js';
import { renderPanelHtml } from './panel.js';
import type { StoryScanResult } from './scan.js';

export interface StorybookAddonApi {
  add(id: string, entry: { title: string; type: string; render: () => string }): void;
}

export interface StorybookAddonsApi {
  register(id: string, callback: (api: StorybookAddonApi) => void): void;
}

export function registerAriadaPanel(addons: StorybookAddonsApi, latest?: () => StoryScanResult | undefined): void {
  addons.register(ADDON_ID, (api) => {
    api.add(PANEL_ID, {
      title: 'Ariada',
      type: 'panel',
      render: () => renderPanelHtml(latest?.()),
    });
  });
}
