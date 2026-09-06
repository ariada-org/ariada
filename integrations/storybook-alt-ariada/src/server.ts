// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/server.js` and `dist/server.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// This module has since been released from that comparison.
//
// HOW IT IS HELD NOW. While the comparison still matched, thirteen behaviour
// tests were written against it, and only then was the request handler split
// into locating a file and sending it. It sat at twenty-four against a limit of
// fifteen.
//
// The two escape checks were each shown to be load-bearing, and the first one
// only after the tests were extended. Removing the second failed a test at once;
// removing the FIRST failed nothing, which meant the tests did not cover it. The
// case that distinguishes it is an escape naming a directory that exists outside
// the root: without the first check the request falls through to the index and
// is answered with the front page rather than refused. Nothing leaks either way,
// and "refused" is still the correct answer.
//
// The guarantee lives in `tests/scripts/recovered-storybook-alt-server.test.ts`,
// and the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// THIS IS A STATIC SERVER THAT ALSO ANSWERS ONE QUESTION THE SCANNER CANNOT ASK:
// has this story finished rendering. Everything unusual here follows from that.
//
// A hidden image is injected into every page, requesting an address the server
// deliberately does not answer until the story reports itself ready. So the
// browser's own "page finished loading" is delayed until the story has actually
// rendered — which is the only lever available, because the scanner decides when
// to look and cannot be told to wait.
//
// The page also polls for the platform's readiness attribute and listens for a
// message from a story running in a frame, since the two platforms signal
// differently. Whichever arrives first releases the hold once.
//
// A TIMEOUT RELEASES THE HOLD AND RECORDS THAT IT TIMED OUT, WHICH IS THE POINT.
// Releasing alone would let a story that never rendered be scanned as if it had,
// and the run would report no findings for it. The flag is what makes the runner
// fail rather than pass quietly.
//
// The token is derived from the story and a counter, and its shape is checked
// before use: it arrives from the page as a query parameter, and it is the key
// into a map this process holds.
//
// A request for a missing path with no extension falls back to the index, which
// is how these platforms route in the browser; a missing file that looks like an
// asset stays a 404, so a broken script does not silently serve HTML.
//
// Every held response is answered on close, so shutting down does not leave a
// browser waiting.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Stats } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';

import type { StoryDescriptor, StoryPlatform } from './types.js';

export interface PreparedStory {
  story: StoryDescriptor;
  token: string;
}

export interface StaticStoryServer {
  origin: string;
  prepareStory: (story: StoryDescriptor) => PreparedStory;
  assertReady: (token: string) => void;
  close: () => Promise<void>;
}

interface StoryState {
  ready: boolean;
  timedOut: boolean;
  holds: Set<ServerResponse>;
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export async function startStaticStoryServer(root: string, platform: StoryPlatform, timeoutMs: number): Promise<StaticStoryServer> {
  const realRoot = await realpath(root);
  if (!(await stat(realRoot)).isDirectory()) throw new Error('staticDir must be a directory');
  const states = new Map<string, StoryState>();
  let sequence = 0;
  const server = createServer((request, response) => {
    void serve(request.method ?? 'GET', request.url ?? '/', realRoot, platform, timeoutMs, states, response).catch((error) => {
      if (response.headersSent) return response.destroy();
      reply(response, 500, error instanceof Error ? error.message : 'Static server failure');
    });
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('Loopback server did not expose a TCP port');
  }
  const origin = 'http://127.0.0.1:' + address.port;
  return {
    origin,
    prepareStory(story) {
      sequence += 1;
      const token = createHash('sha256').update(story.id + '\0' + story.url + '\0' + sequence).digest('hex').slice(0, 32);
      states.set(token, { ready: false, timedOut: false, holds: new Set() });
      const url = new URL(story.url);
      url.searchParams.set('__ariada_story_token', token);
      return { story: { ...story, url: url.href }, token };
    },
    assertReady(token) {
      const state = states.get(token);
      if (state === undefined || !state.ready) throw new Error('Story readiness was not confirmed by ' + platform);
      if (state.timedOut) throw new Error('Story readiness timed out before the Ariada scan');
      states.delete(token);
    },
    close: () => new Promise<void>((resolveClose, reject) => {
      for (const state of states.values()) {
        for (const response of state.holds)
          reply(response, 503, 'Server closing');
      }
      server.close((error) => (error === undefined ? resolveClose() : reject(error)));
      server.closeAllConnections();
    }),
  };
}

type Located =
  | { kind: 'file'; path: string; info: Stats }
  | { kind: 'refused'; status: number; message: string };

/**
 * The file a request names, or the reason it is refused.
 *
 * TWO ESCAPE CHECKS, AND THEY CATCH DIFFERENT THINGS. The first refuses a
 * resolved path that lands outside the served directory; without it, an escape
 * naming a directory that exists outside gets as far as the fallback and is
 * answered with the front page rather than a refusal. The second runs after
 * symbolic links are resolved, and it is the one that stops a link living inside
 * the directory and pointing anywhere on the machine — that link's own path is
 * inside, so the first check passes it.
 *
 * The extensionless miss falls back to the index, because a story library routes
 * in the browser. A miss WITH an extension does not: that is a real asset really
 * missing, and answering it with markup would hide the fault.
 */
async function locate(root: string, pathname: string): Promise<Located> {
  let file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!inside(root, file)) return { kind: 'refused', status: 403, message: 'Forbidden' };
  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = resolve(file, 'index.html');
      info = await stat(file);
    }
    if (!info.isFile()) return { kind: 'refused', status: 404, message: 'Not found' };
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' || extname(pathname) !== '')
      return { kind: 'refused', status: code === 'ENOENT' ? 404 : 500, message: 'Not found' };
    file = resolve(root, 'index.html');
  }
  const realFile = await realpath(file);
  if (!inside(root, realFile)) return { kind: 'refused', status: 403, message: 'Forbidden' };
  const info = await stat(realFile);
  if (!info.isFile()) return { kind: 'refused', status: 404, message: 'Not found' };
  return { kind: 'file', path: realFile, info };
}

async function serve(
  method: string,
  rawUrl: string,
  root: string,
  platform: StoryPlatform,
  timeoutMs: number,
  states: Map<string, StoryState>,
  response: ServerResponse,
): Promise<void> {
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST')
    return reply(response, 405, 'Method not allowed');
  let url: URL;
  try {
    url = new URL(rawUrl, 'http://127.0.0.1');
  }
  catch {
    return reply(response, 400, 'Bad request');
  }
  if (url.pathname === '/__ariada_hold') return hold(url, states, response);
  if (url.pathname === '/__ariada_ready') return markReady(url, states, response);
  if (method === 'POST') return reply(response, 405, 'Method not allowed');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  }
  catch {
    return reply(response, 400, 'Bad request');
  }
  if (pathname.includes('\0')) return reply(response, 400, 'Bad request');
  const found = await locate(root, pathname);
  if (found.kind === 'refused') return reply(response, found.status, found.message);
  const realFile = found.path;
  const info = found.info;
  const type = CONTENT_TYPES[extname(realFile).toLowerCase()] ?? 'application/octet-stream';
  response.statusCode = 200;
  response.setHeader('content-type', type);
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  if (type.startsWith('text/html')) {
    const html = injectReadiness(await readFile(realFile, 'utf8'), platform, timeoutMs);
    response.setHeader('content-length', Buffer.byteLength(html));
    return void response.end(method === 'HEAD' ? undefined : html);
  }
  response.setHeader('content-length', info.size);
  if (method === 'HEAD') return void response.end();
  createReadStream(realFile).on('error', () => response.destroy()).pipe(response);
}

function hold(url: URL, states: Map<string, StoryState>, response: ServerResponse): void {
  const state = stateFor(url, states);
  if (state === undefined) return reply(response, 404, 'Unknown story token');
  if (state.ready) {
    response.statusCode = 204;
    return void response.end();
  }
  response.statusCode = 200;
  response.setHeader('content-type', 'image/gif');
  response.setHeader('cache-control', 'no-store');
  state.holds.add(response);
  response.on('close', () => state.holds.delete(response));
}

function markReady(url: URL, states: Map<string, StoryState>, response: ServerResponse): void {
  const state = stateFor(url, states);
  if (state === undefined) return reply(response, 404, 'Unknown story token');
  state.ready = true;
  state.timedOut = url.searchParams.get('timeout') === '1';
  for (const holdResponse of state.holds) {
    holdResponse.statusCode = 204;
    holdResponse.end();
  }
  state.holds.clear();
  response.statusCode = 204;
  response.end();
}

function stateFor(url: URL, states: Map<string, StoryState>): StoryState | undefined {
  const token = url.searchParams.get('token');
  if (token === null || !/^[a-f0-9]{32}$/.test(token)) return undefined;
  return states.get(token);
}

function injectReadiness(html: string, platform: StoryPlatform, timeoutMs: number): string {
  const script = [
    '<script>',
    '(() => {',
    'const token = new URL(location.href).searchParams.get("__ariada_story_token");',
    'if (!token) return;',
    'const hold = new Image(); hold.hidden = true; hold.alt = "";',
    'hold.src = "/__ariada_hold?token=" + encodeURIComponent(token);',
    'document.documentElement.appendChild(hold);',
    'let complete = false; let interval;',
    'const signal = (timedOut) => {',
    'if (complete) return; complete = true; clearInterval(interval);',
    'fetch("/__ariada_ready?token=" + encodeURIComponent(token) + (timedOut ? "&timeout=1" : ""),',
    '{ method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});',
    '};',
    'const marked = (doc) => doc.documentElement.hasAttribute(' +
      JSON.stringify(platform === 'ladle' ? 'data-storyloaded' : 'data-ariada-storyloaded') +
      ');',
    'const isReady = () => {',
    'if (marked(document)) return true;',
    'for (const frame of document.querySelectorAll("iframe")) {',
    'try { if (frame.contentDocument && marked(frame.contentDocument)) return true; } catch {}',
    '}',
    'return false;',
    '};',
    'addEventListener("message", (event) => {',
    'if (event.origin === location.origin && event.data && event.data.type === "ariada:story-ready") signal(false);',
    '});',
    'interval = setInterval(() => { if (isReady()) signal(false); }, 25);',
    'if (isReady()) signal(false);',
    'setTimeout(() => signal(true), ' + timeoutMs + ');',
    '})();',
    '</script>',
  ].join('');
  const marker = '</head>';
  return html.includes(marker) ? html.replace(marker, script + marker) : script + html;
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep));
}

function reply(response: ServerResponse, status: number, message: string): void {
  if (response.writableEnded) return;
  response.statusCode = status;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(message + '\n');
}
