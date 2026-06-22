// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { URL } from "node:url";

const DEFAULT_OUTPUT_DIR = ".netlify/ariada";
const DEFAULT_THRESHOLD = "moderate";
const OK_EXIT = 0;
const VIOLATIONS_EXIT = 1;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

function commandParts(command) {
  if (Array.isArray(command)) return command;
  return String(command || "ariada").trim().split(/\s+/).filter(Boolean);
}

function safePath(root, requestUrl) {
  const rawPath = String(requestUrl || "/").split("?")[0].split("#")[0];
  const decodedRawPath = decodeURIComponent(rawPath);
  if (decodedRawPath.split("/").includes("..")) return null;

  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = resolve(root, normalize(relative));
  const rootPrefix = resolve(root) + sep;
  if (candidate !== resolve(root) && !candidate.startsWith(rootPrefix)) {
    return null;
  }
  return candidate;
}

async function staticFile(root, requestUrl) {
  const candidate = safePath(root, requestUrl);
  if (!candidate) return null;

  let info;
  try {
    info = await stat(candidate);
  } catch {
    return null;
  }

  if (info.isDirectory()) {
    return staticFile(root, join(requestUrl, "index.html"));
  }
  if (!info.isFile()) return null;
  return candidate;
}

async function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    const file = await staticFile(root, req.url || "/");
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found\n");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME_TYPES.get(extname(file)) || "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to allocate localhost port for ariada scan");
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

function runAriada(command, args, logs) {
  const parts = commandParts(command);
  const bin = parts.shift();
  if (!bin) throw new Error("Ariada command is empty");

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(bin, [...parts, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", rejectRun);
    child.once("close", (code) => {
      if (stdout.trim()) logs?.info(stdout.trim());
      if (stderr.trim()) logs?.warn(stderr.trim());
      resolveRun({ code: code ?? 0, stdout, stderr });
    });
  });
}

function publishDirectory(inputs, constants, netlifyConfig) {
  return resolve(
    inputs.publishDir ||
      constants.PUBLISH_DIR ||
      netlifyConfig?.build?.publish ||
      "dist",
  );
}

/**
 *
 */
export async function runPlugin({ inputs = {}, constants = {}, netlifyConfig = {}, utils = {} }) {
  const logs = utils.status || console;
  const build = utils.build || {};
  const publishDir = publishDirectory(inputs, constants, netlifyConfig);
  const outputDir = resolve(inputs.outputDir || DEFAULT_OUTPUT_DIR);
  const threshold = inputs.severityThreshold || DEFAULT_THRESHOLD;
  const failBuild = inputs.failBuild !== false && inputs.failBuild !== "false";
  const timeoutMs = Number(inputs.timeoutMs || 30000);

  await mkdir(outputDir, { recursive: true });
  await stat(publishDir);

  const server = await startStaticServer(publishDir);
  try {
    logs.info?.(`Ariada Netlify plugin scanning ${server.url}`);
    const result = await runAriada(
      inputs.command || "ariada",
      [
        "scan",
        server.url,
        "--format",
        "both",
        "--output-dir",
        outputDir,
        "--severity-threshold",
        threshold,
        "--timeout-ms",
        String(timeoutMs),
      ],
      logs,
    );

    if (result.code === OK_EXIT) {
      logs.info?.(`Ariada scan passed. Evidence: ${join(outputDir, "scan.json")}`);
      return;
    }

    if (result.code === VIOLATIONS_EXIT) {
      const message = `Ariada accessibility gate found violations. Evidence: ${join(outputDir, "scan.json")}`;
      if (failBuild && typeof build.failBuild === "function") {
        build.failBuild(message);
        return;
      }
      if (failBuild) {
        throw new Error(message);
      }
      logs.warn?.(message);
      return;
    }

    throw new Error(`Ariada CLI failed with exit code ${result.code}`);
  } finally {
    await server.close();
  }
}

export const onPostBuild = runPlugin;

export const internals = {
  commandParts,
  publishDirectory,
  safePath,
  startStaticServer,
};
