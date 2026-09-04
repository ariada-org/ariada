// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/plugin.js` and `dist/plugin.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { renderFindingsPanel } from './panel.js';
import { runAriadaScan, type BuilderContent, type CommandRunner } from './scan.js';

export type BuilderPluginHost = {
  registerAction: (action: {
    id: string;
    label: string;
    onRun: (content: BuilderContent) => Promise<string>;
  }) => void;
};

/**
 * Register the one action this plugin adds to the editor.
 *
 * @param host - the editor's plugin surface
 * @param runner - how commands are run
 */
export function registerBuilderPlugin(host: BuilderPluginHost, runner: CommandRunner): void {
  host.registerAction({
    id: 'ariada.accessibility.scan',
    label: 'Scan with Ariada',
    onRun: async (content) => renderFindingsPanel(await runAriadaScan(content, runner)),
  });
}
