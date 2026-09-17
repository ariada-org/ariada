/**
 * ariada.org — false-marking geo-fence middleware (CF Pages Functions).
 *
 * Provisioned proactively for defence in depth, following the same shape as the
 * middleware on the other sites this organisation runs.
 *
 * Today no page here carries a protection notice at all — the pages under
 * src/pages were checked and none of them makes such a claim. This sits in front
 * of static asset delivery so that a later one, added to a post or a new package
 * page without anyone thinking about jurisdiction, is rewritten on the way out
 * rather than reaching a reader in a country where the claim does not hold.
 *
 * The rule it implements: a claim of patent protection may only be shown
 * where it is true, so the notice is served by jurisdiction rather than to
 * everyone, and the page carries a fallback for everyone else.
 *
 * Author: Agonist Development AB.
 */

import { tier } from "../../_shared/geo-allowlist";

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
