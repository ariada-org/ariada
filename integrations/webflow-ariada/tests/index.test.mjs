import assert from 'node:assert/strict';
import test from 'node:test';

import {
 WEBFLOW_SOURCE,
 buildPanelViewModel,
 createWebflowOAuthUrl,
 createWebflowScanRequest,
 normalizeAriadaFindings,
 summarizeFindings,
} from '../src/index.mjs';

test('builds a Webflow OAuth authorization URL', () => {
 const url = new URL(createWebflowOAuthUrl({
 clientId: 'wf_client_123',
 redirectUri: 'https://ariada.example.test/oauth/webflow/callback',
 scopes: ['sites:read', 'authorized_user:read'],
 state: 'nonce-1',
 }));
 assert.equal(url.origin + url.pathname, 'https://webflow.com/oauth/authorize');
 assert.equal(url.searchParams.get('response_type'), 'code');
 assert.equal(url.searchParams.get('client_id'), 'wf_client_123');
 assert.equal(url.searchParams.get('redirect_uri'), 'https://ariada.example.test/oauth/webflow/callback');
 assert.equal(url.searchParams.get('scope'), 'sites:read authorized_user:read');
 assert.equal(url.searchParams.get('state'), 'nonce-1');
});

test('creates a hosted Ariada scan request for the current Webflow page', () => {
 assert.deepEqual(createWebflowScanRequest({
 locale: 'sv-SE',
 pageId: 'page-home',
 pageUrl: 'https://client.example.test/',
 siteId: 'site-123',
 }), {
 context: { locale: 'sv-SE', pageId: 'page-home', siteId: 'site-123' },
 domains: ['accessibility'],
 severityThreshold: 'serious',
 source: WEBFLOW_SOURCE,
 url: 'https://client.example.test/',
 });
});

test('normalizes Ariada reports from array and multi-domain grid shapes', () => {
 assert.deepEqual(normalizeAriadaFindings({
 findings: [{ id: 'axe/image-alt', message: 'Image missing alt', selector: 'img.hero', severity: 'critical' }],
 }), [
 { message: 'Image missing alt', ruleId: 'axe/image-alt', selector: 'img.hero', severity: 'critical' },
 ]);
 assert.deepEqual(normalizeAriadaFindings({
 grid: {
 'https://client.example.test/': {
 accessibility: [{ ruleId: 'aria/label', message: 'Button needs label', target: 'button', impact: 'serious' }],
 },
 },
 }), [
 { message: 'Button needs label', ruleId: 'aria/label', selector: 'button', severity: 'serious' },
 ]);
});

test('summarizes findings for a Designer panel badge', () => {
 assert.deepEqual(summarizeFindings([
 { severity: 'serious' },
 { severity: 'critical' },
 { severity: 'serious' },
 ]), {
 counts: { critical: 1, serious: 2, moderate: 0, minor: 0 },
 total: 3,
 worstSeverity: 'critical',
 });
});

test('builds the panel view model without scanner logic', () => {
 const view = buildPanelViewModel({
 pageId: 'page-home',
 pageTitle: 'Home',
 pageUrl: 'https://client.example.test/',
 report: { findings: [{ ruleId: 'axe/color-contrast', message: 'Contrast issue', severity: 'serious' }] },
 siteId: 'site-123',
 });
 assert.equal(view.pageTitle, 'Home');
 assert.equal(view.scanRequest.source, WEBFLOW_SOURCE);
 assert.equal(view.summary.total, 1);
 assert.equal(view.findings[0].ruleId, 'axe/color-contrast');
});
