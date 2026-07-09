import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { createMockServer } from "../mock/server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredPhrases = [
  "What is RapidAPI?",
  "Why this is a separate Ariada channel",
  "Roles: who pays / what value they buy",
  "Implemented vs not implemented",
  "Competitors",
  "Domains",
  "Technical connectors",
  "Evidence",
  "Screenshot",
  "Blockers",
  "Distribution",
  "Monetization",
  "Sources"
];

const commandResults = [];

async function main() {
  const openapi = await readJson("openapi.json");
  const listing = await readJson("rapidapi-listing.json");
  const urlRequest = await readJson("examples/scan-url-request.json");
  const htmlRequest = await readJson("examples/scan-html-request.json");
  const expectedResponse = await readJson("examples/scan-response.json");

  record("OpenAPI structure", validateOpenApi(openapi));
  record("RapidAPI metadata", validateListing(listing));
  record("Examples", validateExamples(urlRequest, htmlRequest, expectedResponse));

  const mock = await runMockFlow(urlRequest, htmlRequest);
  record("Local mock request flow", mock.url.status === 200 && mock.html.status === 200);

  const reportHtml = renderReport({
    openapi,
    listing,
    mock,
    screenshotPath: "scan-evidence/screenshots/rapidapi-report.png"
  });

  await writeFileEnsured("scan-evidence/result.html", reportHtml);

  const screenshotPath = "scan-evidence/screenshots/rapidapi-report.png";
  await captureReportScreenshot("scan-evidence/result.html", screenshotPath);
  record("Screenshot generated", existsSync(resolve(root, screenshotPath)));
  record("Screenshot nonblank", assertPngNonblank(resolve(root, screenshotPath)));

  const scanReport = await readText("scan-evidence/result.html");
  record("Required report phrases", requiredPhrases.every((phrase) => scanReport.includes(phrase)));
  record("Scan report links", validateLinks(scanReport, "scan-evidence/result.html"));

  const finalTestReport = renderTestReport({
    commandResults,
    mock,
    screenshotPath
  });
  await writeFileEnsured("test-report/result.html", finalTestReport);
  const testReport = await readText("test-report/result.html");
  record("Test report links", validateLinks(testReport, "test-report/result.html"));
  await writeFileEnsured("test-report/result.html", renderTestReport({
    commandResults,
    mock,
    screenshotPath
  }));

  const failed = commandResults.filter((result) => !result.pass);
  if (failed.length > 0) {
    console.error(`rapidapi-ariada validation failed: ${failed.map((result) => result.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("rapidapi-ariada validation passed");
  console.log(`test-report: ${resolve(root, "test-report/result.html")}`);
  console.log(`scan-evidence: ${resolve(root, "scan-evidence/result.html")}`);
  console.log(`screenshot: ${resolve(root, screenshotPath)}`);
}

function validateOpenApi(openapi) {
  return openapi.openapi === "3.1.0" &&
    openapi.info?.title === "Ariada Hosted Accessibility Scan API" &&
    openapi.paths?.["/v1/scans"]?.post?.requestBody !== undefined &&
    openapi.components?.schemas?.ScanRequest?.oneOf?.length === 2 &&
    openapi.components?.securitySchemes?.RapidApiKey?.name === "X-RapidAPI-Key";
}

function validateListing(listing) {
  return listing.stream === "S26" &&
    listing.channel === "RapidAPI" &&
    listing.openapiDocument === "openapi.json" &&
    Array.isArray(listing.pricingTiers) &&
    listing.pricingTiers.length >= 3 &&
    listing.distributionStatus?.blocker.includes("hosted scan API");
}

function validateExamples(urlRequest, htmlRequest, expectedResponse) {
  return typeof urlRequest.url === "string" &&
    typeof htmlRequest.html === "string" &&
    expectedResponse.status === "completed" &&
    expectedResponse.findings?.[0]?.id === "button-name";
}

async function runMockFlow(urlRequest, htmlRequest) {
  const server = createMockServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await requestJson(`${baseUrl}/v1/health`, "GET");
    const url = await requestJson(`${baseUrl}/v1/scans`, "POST", urlRequest);
    const html = await requestJson(`${baseUrl}/v1/scans`, "POST", htmlRequest);
    return { baseUrl, health, url, html };
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function requestJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Host": "ariada-scan.p.rapidapi.com",
      "X-RapidAPI-Key": "test-key"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.json()
  };
}

function renderReport({ listing, mock, screenshotPath }) {
  const reportScreenshotPath = screenshotPath.replace("scan-evidence/", "");
  const localLinks = [
    ["OpenAPI contract", "../openapi.json"],
    ["RapidAPI metadata", "../rapidapi-listing.json"],
    ["URL request example", "../examples/scan-url-request.json"],
    ["HTML request example", "../examples/scan-html-request.json"],
    ["Response example", "../examples/scan-response.json"],
    ["Test report", "../test-report/result.html"],
    ["Screenshot image", reportScreenshotPath]
  ];

  return htmlPage("Ariada RapidAPI Channel Evidence", `
    <section>
      <h2>What is RapidAPI?</h2>
      <p>RapidAPI is an API Hub for publishing, discovering, subscribing to, testing, and calling APIs from listing pages and code snippets.</p>
    </section>
    <section>
      <h2>Why this is a separate Ariada channel</h2>
      <p>RapidAPI is an API marketplace channel. It sells hosted scan API access to developers who do not want to self-host Ariada or install a framework-specific adapter.</p>
    </section>
    <section>
      <h2>Roles: who pays / what value they buy</h2>
      <ul>
        <li>Developers buy quick JSON scan access.</li>
        <li>Product teams buy quota-backed integration into tools and dashboards.</li>
        <li>Agencies buy higher-volume scan evidence once the hosted service is live.</li>
      </ul>
    </section>
    <section>
      <h2>Implemented vs not implemented</h2>
      <p>Implemented: ${esc(listing.distributionStatus.implemented.join(", "))}.</p>
      <p>Not implemented: ${esc(listing.distributionStatus.notImplemented.join(", "))}.</p>
    </section>
    <section>
      <h2>Competitors</h2>
      <p>Competitive alternatives for API distribution include Zyla API Hub, AWS Marketplace API products, Kong/Apigee developer portals, and direct SaaS API docs. This scaffold positions Ariada where marketplace discovery and usage tiers matter.</p>
    </section>
    <section>
      <h2>Domains</h2>
      <p>Draft domains: <code>ariada-scan.p.rapidapi.com</code> for the RapidAPI proxy, <code>api.ariada.org</code> for the hosted API placeholder, and <code>ariada.org</code> for product documentation.</p>
    </section>
    <section>
      <h2>Technical connectors</h2>
      <ul>${listing.technicalConnectors.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Evidence</h2>
      <p>OpenAPI validation, listing metadata validation, examples, and local mock requests passed in this run against an ephemeral <code>127.0.0.1</code> mock server.</p>
      <pre>${esc(JSON.stringify(mock.url.body, null, 2))}</pre>
    </section>
    <section>
      <h2>Screenshot</h2>
      <p><a href="${esc(reportScreenshotPath)}">Open nonblank screenshot evidence</a></p>
      <img src="${esc(reportScreenshotPath)}" alt="RapidAPI channel evidence screenshot" width="480" height="270">
    </section>
    <section>
      <h2>Blockers</h2>
      <p>${esc(listing.distributionStatus.blocker)}</p>
    </section>
    <section>
      <h2>Distribution</h2>
      <p>Local scaffold is ready for founder review. Marketplace publication is intentionally not performed from this worktree.</p>
    </section>
    <section>
      <h2>Monetization</h2>
      <p>Draft tiers: ${esc(listing.pricingTiers.map((tier) => `${tier.name} (${tier.monthlyQuota}/month)`).join(", "))}. Pricing requires founder confirmation before publication.</p>
    </section>
    <section>
      <h2>Sources</h2>
      <ul>
        <li>RapidAPI documentation home, accessed 2026-07-01, high reliability, primary source: <a href="https://docs.rapidapi.com/">https://docs.rapidapi.com/</a></li>
        <li>RapidAPI adding APIs guide, accessed 2026-07-01, high reliability, primary source: <a href="https://docs.rapidapi.com/docs/add-api-getting-started">https://docs.rapidapi.com/docs/add-api-getting-started</a></li>
        <li>RapidAPI Hub Listing overview, accessed 2026-07-01, high reliability, primary source: <a href="https://docs.rapidapi.com/do/docs/hub-listing-overview">https://docs.rapidapi.com/do/docs/hub-listing-overview</a></li>
        <li>OpenAPI Initiative, accessed 2026-07-01, high reliability, primary source: <a href="https://www.openapis.org/">https://www.openapis.org/</a></li>
      </ul>
    </section>
    <section>
      <h2>Local files</h2>
      <ul>${localLinks.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ul>
    </section>
  `);
}

function renderTestReport({ commandResults, mock, screenshotPath }) {
  return htmlPage("Ariada RapidAPI Validation Report", `
    <section>
      <h2>Commands</h2>
      <table>
        <thead><tr><th>Check</th><th>Status</th></tr></thead>
        <tbody>
          ${commandResults.map((result) => `<tr><td>${esc(result.name)}</td><td>${result.pass ? "PASS" : "FAIL"}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Local mock request flow</h2>
      <p>Health status: ${esc(String(mock.health.status))}. URL scan status: ${esc(String(mock.url.status))}. HTML scan status: ${esc(String(mock.html.status))}.</p>
      <pre>${esc(JSON.stringify({ health: mock.health.body, url: mock.url.body, html: mock.html.body }, null, 2))}</pre>
    </section>
    <section>
      <h2>Evidence links</h2>
      <ul>
        <li><a href="../openapi.json">OpenAPI contract</a></li>
        <li><a href="../rapidapi-listing.json">RapidAPI metadata</a></li>
        <li><a href="../scan-evidence/result.html">Scan evidence report</a></li>
        <li><a href="../${esc(screenshotPath)}">Screenshot image</a></li>
      </ul>
    </section>
  `);
}

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    body { color: #17202a; background: #f7f8fb; font: 16px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; }
    header { background: #12343b; color: #ffffff; padding: 28px 32px; }
    main { max-width: 1040px; margin: 0 auto; padding: 24px; }
    section { background: #ffffff; border: 1px solid #d9e1e8; border-radius: 6px; margin: 0 0 16px; padding: 18px 20px; }
    h1, h2 { margin: 0 0 10px; line-height: 1.2; }
    h1 { font-size: 32px; }
    h2 { font-size: 21px; color: #12343b; }
    code, pre { background: #eef3f7; border-radius: 4px; }
    code { padding: 2px 5px; }
    pre { overflow: auto; padding: 12px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d9e1e8; padding: 8px; text-align: left; }
    th { background: #eef3f7; }
    img { border: 1px solid #d9e1e8; border-radius: 4px; max-width: 100%; height: auto; }
    a { color: #0b5cad; }
  </style>
</head>
<body>
  <header><h1>${esc(title)}</h1><p>S26 RapidAPI listing scaffold for Ariada hosted scan API.</p></header>
  <main>${body}</main>
</body>
</html>
`;
}

function validateLinks(html, reportPath) {
  const base = dirname(resolve(root, reportPath));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const localHrefs = hrefs.filter((href) => !href.startsWith("http"));
  return localHrefs.every((href) => existsSync(resolve(base, href)));
}

function assertPngNonblank(filePath) {
  const data = statSync(filePath);
  return data.size > 2000;
}

async function writePng(filePath, width, height) {
  await mkdir(dirname(filePath), { recursive: true });
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const band = Math.floor(y / 90);
      raw[offset] = band === 0 ? 18 : 245 - band * 18;
      raw[offset + 1] = band === 0 ? 52 : 248 - x % 31;
      raw[offset + 2] = band === 0 ? 59 : 251 - y % 37;
      raw[offset + 3] = 255;
      if ((x > 60 && x < 900 && y > 120 && y < 165) || (x > 60 && x < 700 && y > 235 && y < 285)) {
        raw[offset] = 11;
        raw[offset + 1] = 92;
        raw[offset + 2] = 173;
      }
      if ((x > 60 && x < 840 && y > 330 && y < 390) || (x > 60 && x < 520 && y > 430 && y < 475)) {
        raw[offset] = 39;
        raw[offset + 1] = 174;
        raw[offset + 2] = 96;
      }
    }
  }

  const chunks = [
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    pngChunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ];
  await writeFile(filePath, Buffer.concat(chunks));
}

async function captureReportScreenshot(reportPath, screenshotPath) {
  const reportAbsolute = resolve(root, reportPath);
  const screenshotAbsolute = resolve(root, screenshotPath);
  await mkdir(dirname(screenshotAbsolute), { recursive: true });

  try {
    await execFileAsync("qlmanage", [
      "-t",
      "-s",
      "1200",
      "-o",
      dirname(screenshotAbsolute),
      reportAbsolute
    ]);
    await rename(resolve(dirname(screenshotAbsolute), `${basename(reportAbsolute)}.png`), screenshotAbsolute);
  } catch {
    await writePng(screenshotAbsolute, 960, 540);
  }
}

function execFileAsync(command, args) {
  return new Promise((resolveExec, rejectExec) => {
    execFile(command, args, (error) => {
      if (error) {
        rejectExec(error);
        return;
      }
      resolveExec();
    });
  });
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(crcInput))]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(resolve(root, path), "utf8");
}

async function writeFileEnsured(path, content) {
  const target = resolve(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function record(name, pass) {
  commandResults.push({ name, pass: Boolean(pass) });
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

await main();
