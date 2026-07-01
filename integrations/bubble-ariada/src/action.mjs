export function normalizeAriadaResponse(payload, scannedUrl) {
 const findings = Array.isArray(payload.findings)
 ? payload.findings
: Object.values(payload.grid ?? {}).flatMap((domains) => Object.values(domains).flat());
 const serious = findings.filter((finding) => ['serious', 'critical'].includes(finding.severity)).length;
 return {
 ok: serious === 0,
 scanned_url: scannedUrl,
 findings_count: findings.length,
 serious_count: serious,
 summary_text: `Ariada found ${findings.length} finding(s), ${serious} serious or critical.`,
 findings_json: JSON.stringify(findings),
 report_url: payload.reportUrl ?? '',
 raw_json: JSON.stringify(payload)
 };
}

export async function runBubbleAriadaScan(properties, context = {}) {
 const targetUrl = properties.url_to_scan || properties.url || properties.website_url;
 if (!targetUrl || !/^https?:\/\//u.test(targetUrl)) {
 throw new Error('Bubble Ariada action requires an http(s) URL.');
 }

 const endpoint =
 properties.api_url ||
 context.keys?.ARIADA_SCAN_API_URL ||
 'https://api.ariada.org/v1/scans';
 const token = properties.api_token || context.keys?.ARIADA_API_TOKEN || '';
 const response = await fetch(endpoint, {
 method: 'POST',
 headers: {
 'content-type': 'application/json',
...(token ? { authorization: `Bearer ${token}` }: {})
 },
 body: JSON.stringify({
 url: targetUrl,
 domains: properties.domains || ['accessibility'],
 source: 'bubble-plugin'
 })
 });

 if (!response.ok) {
 throw new Error(`Ariada hosted scan failed with HTTP ${response.status}.`);
 }

 return normalizeAriadaResponse(await response.json(), targetUrl);
}
