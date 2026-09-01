import { guardRedirect, resolveAndGuard } from '@ariada-org/url-guard';
import * as robotsParserMod from 'robots-parser';
const robotsParser = (robotsParserMod as unknown as {
  default: (url: string, body: string) => {
    isAllowed: (url: string, ua?: string) => boolean | undefined;
  };
}).default ?? (robotsParserMod as unknown as (url: string, body: string) => {
  isAllowed: (url: string, ua?: string) => boolean | undefined;
});

const SCAN_UA = 'ariada-scan/1.0';
const ROBOTS_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_ROBOTS_BYTES = 512 * 1024;

/**
 * Returns true iff the target URL is a scheme/host we will scan AND its
 * robots.txt does not disallow our user-agent.
 *
 * This is also an SSRF gate: the target host and every robots.txt redirect hop
 * must clear {@link resolveAndGuard} (no loopback/private/link-local/reserved
 * destination). On any SSRF-relevant failure — refused host, resolution error,
 * network/timeout error, or a redirect to a private host — it fails CLOSED
 * (returns false), so an unreachable or hostile robots endpoint can never
 * authorize a scan. Only genuine content-unavailability of an already-guarded
 * host (empty body, non-200) falls back to robots-politeness fail-open.
 */
export async function isScanAllowed(targetUrl: string): Promise<boolean> {
  const guardedTarget = await resolveAndGuard(targetUrl);
  if (guardedTarget.isErr()) return false;

  const robotsUrl = `${guardedTarget.value.url.protocol}//${guardedTarget.value.url.host}/robots.txt`;
  let body: string | null;
  try {
    body = await fetchRobotsGuarded(robotsUrl);
  } catch {
    // Network/timeout error on the SSRF-relevant fetch → fail CLOSED.
    return false;
  }
  if (body === null) return false; // redirect to a private host → fail closed
  if (body === '') return true; // host is public but has no robots.txt → allow
  const robots = robotsParser(robotsUrl, body);
  return robots.isAllowed(targetUrl, SCAN_UA) !== false;
}

/**
 * Fetch robots.txt with redirects followed manually so every hop is re-guarded.
 * Returns the body text, `''` when the host is reachable but serves no usable
 * robots.txt (non-200 / empty), or `null` when a redirect points at a private
 * host (caller fails closed). Throws on network/timeout.
 */
async function fetchRobotsGuarded(startUrl: string): Promise<string | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
      headers: { 'User-Agent': `${SCAN_UA} (+https://ariada.org/bot)` },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return '';
      const nextGuarded = await guardRedirect(location, current);
      if (nextGuarded.isErr()) return null; // redirect to a private host
      current = nextGuarded.value.url.toString();
      continue;
    }
    if (!res.ok) return '';
    return await readCappedBody(res);
  }
  return ''; // too many redirects → treat as no usable robots.txt
}

/** Read a response body, capping the number of bytes consumed. */
async function readCappedBody(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > MAX_ROBOTS_BYTES ? buf.slice(0, MAX_ROBOTS_BYTES) : buf;
  return new TextDecoder('utf-8').decode(slice);
}
