// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The one place this package touches the network, behind an interface so that
// everything above it can be tested without one.

/** A request, complete — nothing is added on the way out. */
export interface HttpRequest {
  readonly method: 'PATCH' | 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly timeoutMs: number;
}

/** A response, with its body already read. */
export interface HttpResponse {
  readonly status: number;
  readonly body?: unknown;
}

/** Anything that can carry one request and return one response. */
export interface HttpTransport {
  request(request: HttpRequest): Promise<HttpResponse>;
}

/** The real one. */
export class FetchHttpTransport implements HttpTransport {
  /**
   * A body that is not JSON is handed back as text rather than thrown away:
   * an error page from something in front of the API is the most useful thing
   * in the log when this goes wrong, and it is never valid JSON.
   */
  async request(request: HttpRequest): Promise<HttpResponse> {
    const init: RequestInit = {
      method: request.method,
      headers: { ...request.headers },
      signal: AbortSignal.timeout(request.timeoutMs),
    };
    if (request.body !== undefined) {
      init.body = JSON.stringify(request.body);
    }

    const response = await fetch(request.url, init);
    const text = await response.text();
    if (text.length === 0) {
      return { status: response.status };
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body };
  }
}
