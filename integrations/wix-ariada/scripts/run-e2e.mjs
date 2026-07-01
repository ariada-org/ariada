import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFixtureServer } from "./mock-server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const testReport = join(root, "test-report");
const scanEvidence = join(root, "scan-evidence");

await mkdir(join(testReport, "logs"), { recursive: true });
await mkdir(scanEvidence, { recursive: true });

const server = createFixtureServer();
const baseUrl = await listen(server);
const output = [];

try {
 const dashboard = await fetch(`${baseUrl}/dashboard`);
 output.push(`GET /dashboard -> ${dashboard.status}`);
 assert(dashboard.ok, "dashboard route failed");
 const html = await dashboard.text();
 assert(html.includes("Ariada compliance scan"), "dashboard title missing");

 const api = await fetch(`${baseUrl}/api/ariada/scan`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({
 channel: "wix-app",
 source: "wix-dashboard-panel",
 siteUrl: "https://example.wixsite.com/accessible-shop"
 })
 });
 output.push(`POST /api/ariada/scan -> ${api.status}`);
 assert(api.ok, "mock scan route failed");
 const scan = await api.json();
 assert(Array.isArray(scan.findings) && scan.findings.length === 3, "expected three mocked findings");
 await writeFile(join(scanEvidence, "mock-scan-response.json"), `${JSON.stringify(scan, null, 2)}\n`);
 output.push(`scan findings -> ${scan.findings.length}`);
 await writeReport({ status: "pass", baseUrl, output });
 await writeFile(join(testReport, "logs/e2e-exit.txt"), "0\n");
} catch (error) {
 output.push(error instanceof Error ? error.stack || error.message: String(error));
 await writeReport({ status: "fail", baseUrl, output });
 await writeFile(join(testReport, "logs/e2e-exit.txt"), "1\n");
 process.exitCode = 1;
} finally {
 await writeFile(join(testReport, "logs/e2e-output.txt"), `${output.join("\n")}\n`);
 server.close();
}

function listen(httpServer) {
 return new Promise((resolve) => {
 httpServer.listen(0, "127.0.0.1", () => {
 const address = httpServer.address();
 resolve(`http://127.0.0.1:${address.port}`);
 });
 });
}

function assert(condition, message) {
 if (!condition) {
 throw new Error(message);
 }
}

async function writeReport({ status, baseUrl, output }) {
 const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariada Wix E2E test report</title>
<link rel="stylesheet" href="../fixture/styles.css">
</head>
<body>
<main class="shell">
<section class="panel">
<h1>Ariada Wix E2E test report</h1>
<p>Status: <strong>${escapeHtml(status)}</strong></p>
<p>Fixture URL used during test: <code>${escapeHtml(baseUrl)}/dashboard</code></p>
<p><a href="logs/e2e-output.txt">Raw E2E output</a> · <a href="logs/e2e-exit.txt">Exit code</a> · <a href="../scan-evidence/mock-scan-response.json">Mock scan JSON</a></p>
<pre>${escapeHtml(output.join("\n"))}</pre>
</section>
</main>
</body>
</html>`;
 await writeFile(join(testReport, "result.html"), html);
}

function escapeHtml(value) {
 return String(value)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;");
}
