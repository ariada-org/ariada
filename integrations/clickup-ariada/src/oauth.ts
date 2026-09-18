export function authorizationUrl(config: { clientId: string; redirectUri: string; state: string }): string {
    const url = new URL('https://app.clickup.com/api');
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', state: config.state }).toString();
    return url.toString();
}
export async function exchangeCode(
    code: string,
    config: { clientId: string; clientSecret: string },
    fetcher: typeof fetch = fetch,
): Promise<{ access_token: string; token_type?: string }> {
    const response = await fetcher('https://api.clickup.com/api/v2/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, client_id: config.clientId, client_secret: config.clientSecret }) });
    if (!response.ok)
        throw new Error(`ClickUp OAuth HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.access_token)
        throw new Error('ClickUp OAuth returned no access token');
    return payload;
}
