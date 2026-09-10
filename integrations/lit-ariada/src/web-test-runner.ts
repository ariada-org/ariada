// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/web-test-runner.js` and its declaration. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shape comes back from the declaration file and the body
// is the compiled one. Checked with
// the rebuild check.
//
// A named entry point for the test runner's configuration, so that a config file
// imports the plugin and nothing else. The main entry exports the browser half
// too, and a configuration file that pulled that in would be loading page code
// into the runner's process.

export { LIT_ARIADA_COMMAND, createLitAriadaPlugin, type LitAriadaPluginOptions, type LitAriadaWebTestRunnerPlugin, type WebTestRunnerCommandContext, } from './plugin.js';
