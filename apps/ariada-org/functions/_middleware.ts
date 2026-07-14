/**
 * ariada.org — false-marking geo-fence middleware (CF Pages Functions).
 *
 * Provisioned proactively for defense-in-depth, mirroring the canonical
 * NORTHROP template at apps/ariada-web/functions/_middleware.ts and the
 * sibling scanner-agonist mirror.
 *
 * Today, ariada.org body content carries NO patent / USPTO / provisional
 * text (verified by content-audit-legal v0.4 §4 Group A scan against
 * src/pages/*.astro). The middleware sits in front of the static asset
 * delivery so that any future regression — a draft accidentally
 * mentioning USPTO numbers in a blog post or a new package page — is
 * caught by the HTMLRewriter pass rather than reaching a DE / JP / FR
 * visitor's eyeballs.
 *
 * Spec: strategy/security/FALSE_MARKING_CF_GEOFENCE_PATTERN_2026-05-04.md §9.
 *
 * Author: Agonist Development AB.
 */

import { tier } from "../../_shared/geo-allowlist.ts";

class PatentDisclosureHandler {
  constructor(private readonly allowed: boolean) {}
  element(element: Element): void {
    if (this.allowed) return;
    const fallback = element.getAttribute("data-patent-fallback");
    if (fallback === null) {
      element.setInnerContent("", { html: false });
      return;
    }
    element.setInnerContent(fallback, { html: true });
  }
}

interface CfRequest extends Request {
  cf?: { country?: string };
}

interface PagesContext {
  request: CfRequest;
  next: () => Promise<Response>;
}

export const onRequest = async (
  context: PagesContext,
): Promise<Response> => {
  try {
    const country =
      context.request.headers.get("CF-IPCountry") ??
      context.request.cf?.country ??
      undefined;
    const visitorTier = tier(country);
    const allowed = visitorTier === 1 || visitorTier === 2;

    const response = await context.next();
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return response;

    const transformed = new HTMLRewriter()
      .on(
        "[data-patent-disclosure]",
        new PatentDisclosureHandler(allowed),
      )
      .transform(response);

    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "private, no-transform");
    headers.set("Vary", "CF-IPCountry");
    headers.set(
      "X-Geo-Tier",
      visitorTier === null ? "denied" : `tier${visitorTier}`,
    );
    return new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers,
    });
  } catch (err) {

    console.error("[geo-fence] middleware error, failing open:", err);
    return context.next();
  }
};
