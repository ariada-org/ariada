/**
 * Public country-tier policy for the Cloudflare Pages geo middleware.
 * Unknown or malformed country codes are denied by default.
 */

/** Countries classified as tier 1. */
export const TIER_1_FULL = ["US", "CA", "AU"] as const;

/** Countries classified as tier 2. */
export const TIER_2_MONITOR = ["SE", "FI", "DK", "NO", "IS"] as const;

/** Countries classified as limited tier 3. */
export const TIER_3_LIMITED = ["GB", "IE"] as const;

/** Every country code recognized by this policy. */
export const ALLOWLIST = [
  ...TIER_1_FULL,
  ...TIER_2_MONITOR,
  ...TIER_3_LIMITED,
] as const;

export type AllowedCountry = (typeof ALLOWLIST)[number];

export type GeoTier = 1 | 2 | 3 | null;

/** Normalize a candidate ISO-2 country code. */
export function normalize(country?: string | null): string | undefined {
  if (typeof country !== "string") return undefined;
  const trimmed = country.trim().toUpperCase();
  if (trimmed.length !== 2) return undefined;
  if (trimmed === "XX" || trimmed === "T1") return undefined;
  return trimmed;
}

/** Return whether a country belongs to the recognized allowlist. */
export function isAllowed(
  country?: string | null,
): country is AllowedCountry {
  const normalized = normalize(country);
  if (normalized === undefined) return false;
  return (ALLOWLIST as readonly string[]).includes(normalized);
}

/** Return a country's tier, or null when it is denied or unknown. */
export function tier(country?: string | null): GeoTier {
  const normalized = normalize(country);
  if (normalized === undefined) return null;
  if ((TIER_1_FULL as readonly string[]).includes(normalized)) return 1;
  if ((TIER_2_MONITOR as readonly string[]).includes(normalized)) return 2;
  if ((TIER_3_LIMITED as readonly string[]).includes(normalized)) return 3;
  return null;
}
