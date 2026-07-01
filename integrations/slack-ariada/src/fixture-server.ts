import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildCiGateFailureMessage, buildScanRequestResponse } from './messages.js';
import type { CiGateFailurePayload } from './types.js';

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

function parseCommandText(rawBody: string, contentType = ''): string {
  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(rawBody) as { text?: string };
    return parsed.text ?? '';
  }

  const params = new URLSearchParams(rawBody);
  return params.get('text') ?? '';
}

export function createFixtureServer(ciFixture: CiGateFailurePayload) {
  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { ok: true, service: 'slack-ariada-fixture' });
      return;
    }

    if (request.method === 'POST' && request.url === '/slack/command') {
      const rawBody = await readBody(request);
      const text = parseCommandText(rawBody, request.headers['content-type']);
      writeJson(response, 200, buildScanRequestResponse(text));
      return;
    }

    if (request.method === 'POST' && request.url === '/ci/gate-failure') {
      writeJson(response, 200, buildCiGateFailureMessage(ciFixture));
      return;
    }

    writeJson(response, 404, { error: 'not_found' });
  });

  return {
    server,
    async start(port = 0): Promise<string> {
      await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
      const address = server.address() as AddressInfo;
      return `http://127.0.0.1:${address.port}`;
    },
    async stop(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
