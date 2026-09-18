import { registerSaleorApp } from './apl.js';
import { type RegisterPayload } from './apl.js';
import { createManifest } from './manifest.js';
import { renderDashboard } from './panel.js';
import { scanStorefront } from './scanner.js';
import type { APL, AuthData, CommandRunner, SaleorScanResult, ShopConfig } from './types.js';

export interface SaleorAppOptions {
    baseUrl: string;
    apl: APL;
    loadShopConfig: (auth: AuthData) => Promise<ShopConfig>;
    runner?: CommandRunner;
    cliCommand?: string;
}
export function createSaleorApp(options: SaleorAppOptions) {
    return {
        manifest: () => createManifest(options.baseUrl),
        register: (payload: RegisterPayload) => registerSaleorApp(payload, options.apl),
        async scan(domain?: string) {
            const auth = domain ? await options.apl.get(domain) : (await options.apl.getAll())[0];
            if (!auth)
                throw new Error('No Saleor installation is registered');
            return scanStorefront(await options.loadShopConfig(auth), options.runner, options.cliCommand);
        },
        render: (result?: SaleorScanResult, error?: string) => renderDashboard(result, error),
    };
}
export async function loadShopConfig(auth: AuthData, storefrontUrl: string | undefined = process.env['SALEOR_STOREFRONT_URL']): Promise<ShopConfig> {
    const response = await fetch(auth.domain.endsWith('/graphql') ? auth.domain : `${auth.domain}/graphql/`, { method: 'POST', headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query SaleorShop { shop { domain { host protocol } } }' }) });
    if (!response.ok)
        throw new Error(`Saleor GraphQL request failed with HTTP ${response.status}`);
    const body = await response.json();
    if (body.errors?.length)
        throw new Error(body.errors[0]?.message ?? 'Saleor GraphQL request failed');
    return storefrontUrl ? { storefrontUrl } : (body.data?.shop ?? {});
}
