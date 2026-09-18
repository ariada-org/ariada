import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { FileAPL } from './apl.js';
import { createSaleorApp, loadShopConfig } from './app.js';
const port = Number(process.env['PORT'] ?? 3000);
const baseUrl = process.env['APP_BASE_URL'] ?? `http://localhost:${port}`;
const app = createSaleorApp({ baseUrl, apl: new FileAPL(process.env['APL_FILE'] ?? './data/saleor-apl.json'), loadShopConfig, cliCommand: process.env['ARIADA_CLI'] ?? 'ariada' });
const server = createServer(async (request, response) => {
    try {
        if (request.method === 'GET' && request.url === '/manifest')
            return json(response, app.manifest());
        if (request.method === 'POST' && request.url === '/register') {
            const payload = JSON.parse(await body(request));
            const auth = await app.register(payload);
            return json(response, { registered: true, domain: auth.domain });
        }
        if (request.method === 'GET' && request.url?.startsWith('/app')) {
            const url = new URL(request.url, baseUrl);
            const result = url.searchParams.get('scan') === 'true' ? await app.scan(url.searchParams.get('saleorApiUrl') ?? undefined) : undefined;
            return html(response, app.render(result));
        }
        response.writeHead(404).end('Not found');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        if (request.url?.startsWith('/app'))
            return html(response, app.render(undefined, message), 500);
        response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: message }));
    }
});
server.listen(port);
function body(request: IncomingMessage): Promise<string> { return new Promise((resolve, reject) => { const chunks: Buffer[] = []; request.on('data', (chunk: Buffer) => chunks.push(chunk)); request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); request.on('error', reject); }); }
function json(response: ServerResponse, value: unknown, status = 200): void { response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value)); }
function html(response: ServerResponse, value: string, status = 200): void { response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }).end(value); }
