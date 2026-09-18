import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { APL, AuthData } from './types.js';

export class MemoryAPL implements APL {
    private readonly values = new Map<string, AuthData>();
    async get(domain: string): Promise<AuthData | undefined> { return this.values.get(domain); }
    async set(value: AuthData): Promise<void> { this.values.set(value.domain, value); }
    async delete(domain: string): Promise<void> { this.values.delete(domain); }
    async getAll(): Promise<AuthData[]> { return [...this.values.values()]; }
}
export class FileAPL implements APL {
    private readonly path: string;

    constructor(path: string) {
        this.path = path;
    }
    private async read(): Promise<AuthData[]> {
        try {
            return JSON.parse(await readFile(this.path, 'utf8'));
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                return [];
            throw error;
        }
    }
    async get(domain: string): Promise<AuthData | undefined> { return (await this.read()).find((item) => item.domain === domain); }
    async set(value: AuthData): Promise<void> {
        const values = (await this.read()).filter((item) => item.domain !== value.domain);
        values.push(value);
        await mkdir(dirname(this.path), { recursive: true });
        // Written beside the file and renamed over it: a crash mid-write leaves
        // the previous credentials intact rather than a half-written file that
        // parses as nothing and logs every shop out.
        const temporary = `${this.path}.tmp`;
        await writeFile(temporary, JSON.stringify(values, null, 2), { mode: 0o600 });
        await rename(temporary, this.path);
    }
    async delete(domain: string): Promise<void> { await this.setAll((await this.read()).filter((item) => item.domain !== domain)); }
    async getAll(): Promise<AuthData[]> { return this.read(); }
    private async setAll(values: AuthData[]): Promise<void> { await mkdir(dirname(this.path), { recursive: true }); await writeFile(this.path, JSON.stringify(values, null, 2), { mode: 0o600 }); }
}
export interface RegisterPayload {
    auth_token?: unknown;
    saleor_api_url?: unknown;
    authToken?: unknown;
    saleorApiUrl?: unknown;
}

export async function registerSaleorApp(payload: RegisterPayload, apl: APL): Promise<AuthData> {
    const token = payload.auth_token ?? payload.authToken;
    const domain = payload.saleor_api_url ?? payload.saleorApiUrl;
    if (typeof token !== 'string' || token.length < 1 || typeof domain !== 'string')
        throw new Error('Saleor registration requires auth_token and saleor_api_url');
    const normalized = new URL(domain).toString().replace(/\/$/, '');
    await apl.set({ domain: normalized, token });
    return { domain: normalized, token };
}
