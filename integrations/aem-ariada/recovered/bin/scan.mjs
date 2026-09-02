#!/usr/bin/env node
import { constants } from "node:fs";
import { access } from "node:fs/promises";

const MODULES = [
  "@ariada-org/cli",
  "@ariada-org/core",
  "@ariada-org/core-engine",
  "@ariada-org/core-playwright",
  "@ariada-org/rules-axe",
  "@ariada-org/wcag-rules-extended",
  "@axe-core/playwright",
  "axe-core",
  "playwright",
  "playwright-core"
];

function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(2);
}

function environmentExecutablePath() {
  return (
    process.env.ARIADA_AEM_BROWSER_EXECUTABLE
    || process.env.ARIADA_EXISTING_CHROMIUM_EXECUTABLE
    || ""
  ).trim();
}

async function probe(options) {
  const resolved = {};
  for (const name of MODULES) {
    await import(name);
    resolved[name] = import.meta.resolve(name);
  }
  const cli = await import("@ariada-org/cli");
  const rules = await import("@ariada-org/rules-axe");
  if (typeof cli.runScan !== "function" || typeof rules.createA11yAnalyzer !== "function") {
    throw new Error("real Ariada CLI or rules analyzer export is unavailable");
  }
  process.stdout.write(JSON.stringify({
    resolved,
    cli: "runScan",
    analyzer: "createA11yAnalyzer",
    browser: {
      channel: options.browserChannel,
      executablePath: options.browserExecutablePath
    }
  }));
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === "--probe") {
    return {
      probe: true,
      browser: "chromium",
      browserChannel: "",
      browserExecutablePath: environmentExecutablePath()
    };
  }
  if (argv.length === 0 || argv[0].startsWith("--")) {
    fail("Usage: ariada-aem-scan <url> --output-dir <path> [options]");
  }
  const options = {
    probe: false,
    url: argv[0],
    outputDir: "",
    browser: "chromium",
    browserChannel: "",
    browserExecutablePath: environmentExecutablePath(),
    severityThreshold: "minor",
    timeoutMs: 45000,
    allowPrivate: false
  };
  for (let index = 1; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--allow-private") {
      options.allowPrivate = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) {
      fail("Missing value for " + option);
    }
    index += 1;
    if (option === "--output-dir") options.outputDir = value;
    else if (option === "--browser") options.browser = value;
    else if (option === "--browser-channel") options.browserChannel = value;
    else if (option === "--browser-executable-path") options.browserExecutablePath = value;
    else if (option === "--severity-threshold") options.severityThreshold = value;
    else if (option === "--timeout-ms") options.timeoutMs = Number.parseInt(value, 10);
    else fail("Unknown option: " + option);
  }
  if (!options.outputDir) fail("--output-dir is required");
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 120000) {
    fail("--timeout-ms must be an integer from 1000 through 120000");
  }
  if (!["chromium", "firefox", "webkit"].includes(options.browser)) {
    fail("--browser must be chromium, firefox, or webkit");
  }
  if (options.browserChannel && options.browser !== "chromium") {
    fail("--browser-channel is supported only with chromium");
  }
  if (options.browserExecutablePath && options.browser !== "chromium") {
    fail("--browser-executable-path is supported only with chromium");
  }
  if (options.browserChannel && options.browserExecutablePath) {
    fail("--browser-channel and --browser-executable-path are mutually exclusive");
  }
  return options;
}

async function configureBrowser(options) {
  const storageState = process.env.ARIADA_AEM_STORAGE_STATE || "";
  if (storageState) await access(storageState);
  if (options.browserExecutablePath) {
    await access(options.browserExecutablePath, constants.X_OK);
  }
  if (!options.browserChannel && !options.browserExecutablePath && !storageState) return;
  const playwright = await import("playwright");
  const launcher = playwright[options.browser];
  const originalLaunch = launcher.launch.bind(launcher);
  launcher.launch = async function (launchOptions = {}) {
    const browser = await originalLaunch({
      ...launchOptions,
      ...(options.browserChannel ? { channel: options.browserChannel } : {}),
      ...(options.browserExecutablePath ? { executablePath: options.browserExecutablePath } : {})
    });
    if (!storageState) return browser;
    const originalContext = browser.newContext.bind(browser);
    browser.newContext = async function (contextOptions = {}) {
      return originalContext({ ...contextOptions, storageState });
    };
    return browser;
  };
}

const options = parseArguments(process.argv.slice(2));
if (options.probe) {
  await configureBrowser(options);
  await probe(options);
} else {
  await configureBrowser(options);
  const cli = await import("@ariada-org/cli");
  const core = await import("@ariada-org/core-playwright");
  const coreScan = async function (url, scanOptions) {
    return core.scan(url, {
      ...scanOptions,
      ...(options.allowPrivate ? { allowPrivate: true } : {})
    });
  };
  const exitCode = await cli.runScan(
    options.url,
    {
      outputDir: options.outputDir,
      browser: options.browser,
      format: "json",
      severityThreshold: options.severityThreshold,
      timeoutMs: options.timeoutMs
    },
    process.stdout,
    process.stderr,
    coreScan
  );
  process.exitCode = exitCode;
}
