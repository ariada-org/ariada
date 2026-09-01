// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// One command a project can run after its build, with nothing to configure at
// the call site.
//
// The first version of this lived in a Makefile: start a static server on a
// fixed port, sleep a second, scan, kill the server. Every one of those pieces
// failed in testing. The port was already taken by an unrelated service, the
// server never bound, the scan reached that other service instead, and five
// findings came back describing its error page. Nothing said anything was
// wrong. A maintainer would have read those five as their own.
//
// So the fragile parts move here, where they can be done properly and tested:
// bind a port the operating system hands out rather than one chosen in advance,
// wait for the server to answer rather than for a second to pass, and check
// that what comes back is the project's own page before scanning it.

import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

import { CliError, emitError } from '../errors.js';
import { EXIT_OK, EXIT_INVALID_ARGS, EXIT_RUNTIME_ERROR, type ExitCode } from '../exit-codes.js';
import {
  outputPath,
  pageUrls,
  readProjectConfig,
  siteRoot,
  type ProjectConfig,
} from '../project-config.js';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Serve a directory on a port the operating system chooses.
 *
 *  Nothing outside the directory is served: a request is resolved and then
 *  checked to still be inside it, because `..` in a path is otherwise a way out
 *  of the site and into the rest of the disk. */
export function serveDirectory(root: string): Promise<{ server: Server; origin: string }> {
  const base = resolve(root);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let target = join(base, normalize(decodeURIComponent(url.pathname)));
    if (target !== base && !target.startsWith(base + sep)) {
      res.writeHead(403).end('outside the site');
      return;
    }

    void (async () => {
      try {
        let info = await stat(target);
        if (info.isDirectory()) {
          target = join(target, 'index.html');
          info = await stat(target);
        }
        res.writeHead(200, {
          'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
          'content-length': String(info.size),
        });
        createReadStream(target).pipe(res);
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      }
    })();
  });

  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    // Port zero: the operating system gives out one that is free. Choosing a
    // number in advance is how the first version came to scan someone else's
    // service.
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('the server did not report a port'));
        return;
      }
      resolveServer({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

/** Ask for a page until it answers, rather than assuming a second is enough. */
export async function waitForPage(url: string, attempts = 40): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      last = new Error(`answered ${response.status}`);
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`${url} never answered — ${(last as Error)?.message ?? 'no response'}`);
}

/** Where the project's configuration is, looking upward from a starting point. */
export async function findConfig(from: string, names: readonly string[]): Promise<string | undefined> {
  let dir = resolve(from);
  for (;;) {
    for (const name of names) {
      const candidate = join(dir, name);
      try {
        if ((await stat(candidate)).isFile()) return candidate;
      } catch {
        // keep looking
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** A finding, on one line, the way a build log is read. */
export function findingLine(
  page: string,
  finding: {
  ruleId: string;
  severity?: string;
  message?: string;
  element?: unknown;
}): string {
  const element = finding.element;
  const where =
    typeof element === 'string'
      ? element
      : ((element as { selector?: string } | undefined)?.selector ?? '');
  const parts = [
    `${page}:`,
    finding.severity ?? 'minor',
    `[${finding.ruleId}]`,
    finding.message ?? '',
  ];
  return where ? `${parts.join(' ')}  — ${where}` : parts.join(' ');
}

/** Read back what the scan wrote and say it in lines. */
async function printFindings(
  reportDir: string,
  origin: string,
  stdout: NodeJS.WritableStream,
): Promise<void> {
  let report: { grid?: Record<string, Record<string, unknown[]>> };
  try {
    report = JSON.parse(await readFile(join(reportDir, 'multi-domain-report.json'), 'utf8'));
  } catch {
    return; // the scan said what it could; there is nothing to add
  }

  const lines: string[] = [];
  for (const [site, domains] of Object.entries(report.grid ?? {})) {
    const page = site.startsWith(origin) ? site.slice(origin.length + 1) || 'index.html' : site;
    for (const findings of Object.values(domains ?? {})) {
      for (const finding of findings ?? []) {
        lines.push(findingLine(page, finding as Parameters<typeof findingLine>[1]));
      }
    }
  }

  if (lines.length === 0) {
    stdout.write('\nNo accessibility findings.\n');
    return;
  }

  stdout.write('\n');
  // Compare the text rather than take the default, which orders by UTF-16 code
  // unit: with a rule id or a selector carrying a non-ASCII character, two runs
  // would list the same findings in an order a reader would not expect. Sorting
  // a copy so the caller's array is left as it was built.
  const ordered = [...lines].sort((a, b) => a.localeCompare(b));
  for (const line of ordered) stdout.write(`${line}\n`);
  stdout.write(`\n${lines.length} finding${lines.length === 1 ? '' : 's'}. Full report in ${reportDir}\n`);
}

/**
 *
 */
export interface CheckOptions {
  /** Where to start looking for the project's configuration. */
  cwd?: string;
  /** A configuration file named outright, skipping the search. */
  config?: string;
  /** Make findings a failure. Off by default: a page having problems is what
   *  this reports, not a reason to break someone's build. */
  strict?: boolean;
}

type ScanRunner = (
  urls: readonly string[],
  options: Record<string, unknown>,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
) => Promise<ExitCode>;

/**
 * Build-and-check, from the project's own declaration of what it wants
 * checked.
 */
export async function runCheck(
  options: CheckOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
  injected?: { scan?: ScanRunner; configNames?: readonly string[] },
): Promise<ExitCode> {
  const names = injected?.configNames ?? ['ariada.json', '.ariada.json', '.ariadarc.json'];
  const path = options.config ?? (await findConfig(options.cwd ?? process.cwd(), names));
  if (path === undefined) {
    emitError(
      new CliError(
        'E_NO_CONFIG',
        `No ${names[0]} found here or above. It says which directory the build ` +
          `produces and which pages to check — see the README for a three-line example.`,
      ),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  let config: ProjectConfig & { dir: string };
  try {
    config = await readProjectConfig(path);
  } catch (error) {
    emitError(new CliError('E_BAD_CONFIG', (error as Error).message), stderr);
    return EXIT_INVALID_ARGS;
  }

  const root = siteRoot(config);
  try {
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory');
  } catch {
    emitError(
      new CliError(
        'E_NO_SITE',
        `${root} is not there. That is where ${path} says the build lands — build the site first.`,
      ),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  const { server, origin } = await serveDirectory(root);
  try {
    const urls = pageUrls(config, origin);

    // Confirm the site is answering with the project's own page before
    // measuring anything. Five findings once came back describing an unrelated
    // service's error page, and nothing in the output said so.
    for (const url of urls) {
      try {
        const response = await waitForPage(url);
        const body = await response.text();
        if (!/<html[\s>]/i.test(body)) {
          emitError(
            new CliError(
              'E_NOT_A_PAGE',
              `${url} did not return an HTML page. Check that ${config.root} is the built ` +
                `site and that ${url.slice(origin.length)} exists inside it.`,
            ),
            stderr,
          );
          return EXIT_INVALID_ARGS;
        }
      } catch (error) {
        emitError(new CliError('E_NOT_SERVED', (error as Error).message), stderr);
        return EXIT_RUNTIME_ERROR;
      }
    }

    const scan = injected?.scan;
    if (!scan) {
      emitError(new CliError('E_INTERNAL', 'no scanner was provided'), stderr);
      return EXIT_RUNTIME_ERROR;
    }

    const verdict = await scan(
      urls,
      {
        ...(config.domains ? { domains: config.domains } : {}),
        outputDir: outputPath(config),
        format: 'both',
        allowPrivate: true,
        ...(config.severityThreshold ? { severityThreshold: config.severityThreshold } : {}),
      },
      stdout,
      stderr,
    );

    // The findings themselves, one per line. A count and a list of rule names
    // tells a maintainer that something is wrong somewhere; this tells them
    // which page, how bad, and what to look for — which is what a link checker
    // gives and what was asked for.
    await printFindings(outputPath(config), origin, stdout);

    // A page with problems is the finding, not a broken build — the same
    // contract a link checker has. A project that wants the other behaviour
    // asks for it, and then gets the scanner's own verdict.
    return options.strict === true ? verdict : EXIT_OK;
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
}
