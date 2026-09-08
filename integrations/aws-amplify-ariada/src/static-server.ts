// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/static-server.js` and `dist/static-server.d.ts`, and then
// released from that comparison — the one module of this package that has been.
//
// HOW IT IS HELD NOW, since it is no longer held by the comparison. The recovery
// matched token for token, and while it did, behaviour tests were written
// against it: at that moment they could not describe anything but the code that
// actually ships. Only then was the request handler split, because one function
// sat above the complexity limit the publishing gate enforces and no amount of
// re-reading was going to lower it. The tests are green either side of that
// split, and removing the escape check turns one of them from a refusal into a
// leaked secret — so they hold what the comparison held.
//
// The guarantee therefore lives in `tests/scripts/recovered-static-server.test.ts`
// and the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
// The other nine modules of this package are unchanged and still compare clean.
//
// A built site is a directory, and a scanner needs an address, so this serves
// the one to produce the other. It exists for exactly that and refuses
// everything beyond it.
//
// THE PATH CHECK IS THE POINT OF THE FILE. A request path is decoded and
// resolved, and the result must be the root itself or lie beneath it with the
// separator present — the separator matters, or a sibling directory whose name
// merely starts with the root's would pass. Without that check, a request can
// walk out of the build output and read anything the process can, and this runs
// in build environments where that is credentials.
//
// It listens on the loopback address and on a port the system picks, so two runs
// on one machine cannot collide and nothing outside the machine can reach it.
//
// Only reading methods are answered. A directory gets its index; a missing file
// gets a not-found rather than an error page, and any other failure becomes a
// bad request instead of leaking the underlying message to the client.
//
// An unknown extension is served as opaque bytes rather than guessed at, which
// keeps the scanner from parsing something as markup because of its name.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

import type { StaticServerHandle } from "./types.js";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function send(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

/**
 * The requested path, resolved inside the served directory, or null if it lands
 * outside it.
 *
 * The result must be the root itself or lie beneath it with the separator
 * present. The separator is the whole point: without it a sibling directory
 * whose name merely begins with the root's — `site-secrets` against `site` —
 * satisfies a prefix test and is served.
 *
 * Most escapes never arrive here, because the address parser normalises `..`
 * and its percent-encoded spelling away first. The one that does is an encoded
 * separator: nothing in `..%2Fsecrets` is a `..` segment, so nothing is
 * normalised, and the decode below turns it back into a path that climbs. Delete
 * this function's last check and that request returns the file.
 */
function resolveWithinRoot(root: string, requestUrl: URL): string | null {
  const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
  const filePath = resolve(root, relativePath.length === 0 ? "index.html" : relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return null;
  }
  return filePath;
}

/** How a failed read is answered: absent is absent, anything else is a bad request. */
function statusForReadError(error: unknown): 404 | 400 {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  return code === "ENOENT" ? 404 : 400;
}

export async function serveDirectory(directory: string): Promise<StaticServerHandle> {
  const root = resolve(directory);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Build output is not a directory: ${root}`);
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("allow", "GET, HEAD");
      send(response, 405, "Method not allowed\n");
      return;
    }
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const resolved = resolveWithinRoot(root, requestUrl);
      if (resolved === null) {
        send(response, 403, "Forbidden\n");
        return;
      }
      let filePath = resolved;
      let fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        filePath = resolve(filePath, "index.html");
        fileStat = await stat(filePath);
      }
      if (!fileStat.isFile()) {
        send(response, 404, "Not found\n");
        return;
      }
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": fileStat.size,
        "content-type":
          CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(filePath);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    }
    catch (error) {
      const status = statusForReadError(error);
      send(response, status, status === 404 ? "Not found\n" : "Bad request\n");
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Static server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error === undefined ? resolveClose() : reject(error)));
      }),
  };
}
