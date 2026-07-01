import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 4177);
const contentTypes = new Map([
 [".css", "text/css; charset=utf-8"],
 [".html", "text/html; charset=utf-8"],
 [".js", "text/javascript; charset=utf-8"],
 [".json", "application/json; charset=utf-8"]
]);

export function createFixtureServer() {
 return createServer(async (request, response) => {
 const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
 if (request.method === "POST" && url.pathname === "/api/ariada/scan") {
 await consume(request);
 const body = await readFile(join(root, "fixture/mock-scan.json"), "utf8");
 response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
 response.end(body);
 return;
 }

 const pathname = url.pathname === "/" || url.pathname === "/dashboard" ? "/fixture/index.html": url.pathname;
 const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
 const filePath = join(root, safePath);
 if (!filePath.startsWith(root)) {
 response.writeHead(403);
 response.end("Forbidden");
 return;
 }
 try {
 const body = await readFile(filePath);
 response.writeHead(200, { "content-type": contentTypes.get(extname(filePath)) || "application/octet-stream" });
 response.end(body);
 } catch {
 response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
 response.end("Not found");
 }
 });
}

if (import.meta.url === `file://${process.argv[1]}`) {
 createFixtureServer().listen(port, "127.0.0.1", () => {
 console.log(`Ariada Wix fixture listening on http://127.0.0.1:${port}/dashboard`);
 });
}

async function consume(stream) {
 for await (const _chunk of stream) {
 // The local fixture does not need request persistence.
 }
}
