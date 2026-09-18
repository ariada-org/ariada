import { createHmac, timingSafeEqual } from 'node:crypto';
// Compared in constant time, and only after the lengths match — timingSafeEqual
// throws on a length mismatch, so the check in front of it is what makes this
// usable rather than a source of exceptions on malformed input.
export function verifyWebhook(body: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const actual = signature.replace(/^sha256=/, '');
    return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
export function parseWebhook<T>(body: string, signature: string, secret: string): T {
    if (!verifyWebhook(body, signature, secret))
        throw new Error('Invalid Linear webhook signature');
    return JSON.parse(body) as T;
}
