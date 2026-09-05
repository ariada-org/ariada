// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/plasmic-component.js` and its declaration. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { renderAriadaPanel } from './panel.js';

export interface PlasmicRegisterComponent {
  (
    component: unknown,
    meta: { name: string; displayName: string; props: Record<string, unknown> },
  ): void;
}

/**
 * Make the panel available as a component inside the builder.
 *
 * @param registerComponent - the builder's registration function
 */
export function registerAriadaComponent(registerComponent: PlasmicRegisterComponent): void {
  registerComponent(renderAriadaPanel, {
    name: 'AriadaScanPanel',
    displayName: 'Ariada Accessibility Scan',
    props: {
      result: { type: 'object', description: 'Mapped result returned by scanPlasmicPage.' },
    },
  });
}
