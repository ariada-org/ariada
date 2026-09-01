import { scanEventSchema } from '@ariada-org/core';
import { z } from 'zod';

/** Brand discriminator. */
export const brandSchema = z.enum(['ariada', 'dracula']);
/**
 *
 */
export type Brand = z.infer<typeof brandSchema>;

/**
 * Edge → VPS scan-worker queue message.
 * @patentBinding('J','IC1')
 */
export const scanRequestMessageSchema = z.object({
  brand: brandSchema,
  scan_id: z.string().min(20).max(40),
  url: z.string().url(),
  callback_url: z.string().url(),
  hmac_key_id: z.literal('v1'),
  requested_at: z.number().int().nonnegative(),
});
/**
 *
 */
export type ScanRequestMessage = z.infer<typeof scanRequestMessageSchema>;

/**
 * Public scan-initiation request (POST /api/scan).
 */
export const scanInitiateSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => /^https?:/.test(u), 'must be http(s)'),
  turnstileToken: z.string().min(1),
});
/**
 *
 */
export type ScanInitiate = z.infer<typeof scanInitiateSchema>;

/**
 * VPS → edge callback body — wraps a ScanEvent.
 */
export const scanCallbackBodySchema = z.object({
  scan_id: z.string(),
  event: scanEventSchema,
});
/**
 *
 */
export type ScanCallbackBody = z.infer<typeof scanCallbackBodySchema>;

/**
 * UTM / events ingest payload.
 */
export const eventIngestSchema = z.object({
  path: z.string().optional(),
  ref: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
});
/**
 *
 */
export type EventIngest = z.infer<typeof eventIngestSchema>;
