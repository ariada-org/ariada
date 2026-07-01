const statusBadge = document.querySelector('#status-badge');
const siteName = document.querySelector('#site-name');
const pageName = document.querySelector('#page-name');
const runButton = document.querySelector('#run-scan');
const summary = document.querySelector('#summary');
const findings = document.querySelector('#findings');

let context;

async function loadContext() {
 context = await fetchJson('/api/context');
 siteName.textContent = context.siteName;
 pageName.textContent = context.pageTitle;
}

async function runScan() {
 statusBadge.textContent = 'Scanning';
 summary.textContent = 'Calling the local hosted-API fixture...';
 findings.replaceChildren();
 const report = await fetchJson('/api/scan', {
 body: JSON.stringify({
 locale: context.locale,
 pageId: context.pageId,
 pageUrl: context.pageUrl,
 siteId: context.siteId,
 }),
 headers: { 'content-type': 'application/json' },
 method: 'POST',
 });
 statusBadge.textContent = `${report.summary.total} found`;
 summary.textContent = `${report.summary.total} finding(s): ${report.summary.counts.critical} critical, ${report.summary.counts.serious} serious.`;
 for (const finding of report.findings) {
 const item = document.createElement('li');
 item.innerHTML = `<strong>${escapeHtml(finding.severity)}</strong><span>${escapeHtml(finding.ruleId)}</span><p>${escapeHtml(finding.message)}</p>`;
 findings.append(item);
 }
}

async function fetchJson(url, options) {
 const response = await fetch(url, options);
 if (!response.ok) throw new Error(`Request failed: ${response.status}`);
 return response.json();
}

function escapeHtml(value) {
 return String(value).replace(/[&<>"']/g, (char) => ({
 '&': '&amp;',
 '<': '&lt;',
 '>': '&gt;',
 '"': '&quot;',
 "'": '&#39;',
 })[char]);
}

runButton.addEventListener('click', () => {
 runScan().catch((error) => {
 statusBadge.textContent = 'Error';
 summary.textContent = error instanceof Error ? error.message: String(error);
 });
});

await loadContext();
if (new URLSearchParams(window.location.search).get('autorun') === '1') {
 await runScan();
}
