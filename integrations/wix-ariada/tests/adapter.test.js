import assert from "node:assert/strict";
import test from "node:test";
import { buildHostedScanRequest, normaliseScanResult, renderFindings } from "../src/adapter.js";

test("buildHostedScanRequest builds a Wix dashboard hosted scan payload", () => {
 const request = buildHostedScanRequest({
 siteUrl: " https://example.wixsite.com/shop ",
 instanceId: "instance-123",
 endpoint: "https://ariada.example/scan"
 });
 assert.equal(request.method, "POST");
 assert.equal(request.endpoint, "https://ariada.example/scan");
 assert.equal(request.body.channel, "wix-app");
 assert.equal(request.body.siteUrl, "https://example.wixsite.com/shop");
 assert.deepEqual(request.body.requestedDomains, ["accessibility", "privacy", "security"]);
});

test("normaliseScanResult counts severities without changing findings", () => {
 const result = normaliseScanResult({
 findings: [
 { severity: "serious", rule: "image-alt" },
 { severity: "moderate", rule: "contrast" },
 { severity: "serious", rule: "label" }
 ]
 });
 assert.equal(result.summary.total, 3);
 assert.equal(result.summary.bySeverity.serious, 2);
 assert.equal(result.summary.bySeverity.moderate, 1);
});

test("renderFindings escapes finding text", () => {
 const html = renderFindings({
 findings: [{ severity: "serious", rule: "<script>", message: "Needs <alt>", selector: "img" }]
 });
 assert.match(html, /&lt;script&gt;/);
 assert.match(html, /Needs &lt;alt&gt;/);
});
