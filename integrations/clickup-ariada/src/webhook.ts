import { createHmac, timingSafeEqual } from 'node:crypto';

import type { ClickUpWebhookEvent } from './types.js';
// Compared in constant time, and only once the lengths match: the primitive
// raises rather than returning false when they differ, so the length check in
// front of it is what makes a short signature a refusal instead of a crash.
export function verifyWebhook(body: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function parseWebhook(body: string, signature: string, secret: string): ClickUpWebhookEvent {
    if (!verifyWebhook(body, signature, secret))
        throw new Error('Invalid ClickUp webhook signature');
    return JSON.parse(body);
}
