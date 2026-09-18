import type { SaleorScanResult } from './types.js';

// Everything that reaches the page goes through here. The findings are text
// taken off somebody else's storefront, and a rule name carrying a tag would
// otherwise be markup in a page an administrator is looking at.
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
export function renderDashboard(result?: SaleorScanResult, error?: string): string {
    if (error)
        return `<!doctype html><main><h1>Ariada accessibility</h1><p role="alert">${escapeHtml(error)}</p></main>`;
    if (!result)
        return '<!doctype html><main><h1>Ariada accessibility</h1><p>Run a scan from the Saleor Dashboard widget.</p></main>';
    const status = result.status === 'passed' ? 'PASS' : 'FAIL';
    const findings = result.findings.map((finding) => `<li><strong>${escapeHtml(finding.ruleId)}</strong> (${escapeHtml(finding.severity)}): ${escapeHtml(finding.message)} <small>${escapeHtml(finding.eaa ?? 'EAA / EN 301 549 mapping supplied by Ariada')}</small></li>`).join('');
    const report = result.reportUrl ? `<p><a href="${escapeHtml(result.reportUrl)}">Open full Ariada report</a></p>` : '';
    return `<!doctype html><meta charset="utf-8"><title>Ariada accessibility</title><main><h1>Ariada accessibility</h1><p><strong data-status="${status}">${status}</strong> for <code>${escapeHtml(result.storefrontUrl)}</code></p><p>${result.totalFindings} finding(s), mapped to EAA / EN 301 549 where provided.</p>${findings ? `<h2>Top findings</h2><ol>${findings}</ol>` : '<p>No findings returned by Ariada.</p>'}${report}</main>`;
}
