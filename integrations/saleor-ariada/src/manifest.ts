import type { SaleorManifest } from './types.js';

export function createManifest(baseUrl: string): SaleorManifest {
    const root = baseUrl.replace(/\/$/, '');
    return {
        id: 'com.ariada.saleor',
        version: '1.0.0',
        requiredSaleorVersion: '^3.20',
        name: 'Ariada Accessibility for Saleor',
        author: 'Ariada',
        about: 'Scans the connected Saleor storefront with the shared Ariada CLI and surfaces EAA findings.',
        permissions: ['MANAGE_SETTINGS'],
        appUrl: `${root}/app`,
        tokenTargetUrl: `${root}/register`,
        dataPrivacy: 'Ariada stores the Saleor API domain and app token required for authenticated scans.',
        homepageUrl: root,
        supportUrl: `${root}/support`,
        extensions: [{
                label: 'Ariada accessibility scan',
                mount: 'HOMEPAGE_WIDGETS',
                target: 'WIDGET',
                permissions: ['MANAGE_SETTINGS'],
                url: `${root}/app`,
                options: { homeWidgetTarget: { method: 'GET', fullscreen: false } },
            }],
        webhooks: [],
    };
}
