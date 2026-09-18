export function authorizationUrl(config: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes?: string[];
}): string {
    const url = new URL('https://linear.app/oauth/authorize');
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: (config.scopes ?? ['read', 'write']).join(','), state: config.state }).toString();
    return url.toString();
}
export async function exchangeCode(
    code: string,
    config: { clientId: string; clientSecret: string; redirectUri: string },
    fetcher: typeof fetch = fetch,
): Promise<{ access_token: string; token_type: string }> {
    const response = await fetcher('https://api.linear.app/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }) });
    if (!response.ok)
        throw new Error(`Linear OAuth HTTP ${response.status}`);
    return await response.json();
}
