// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The one status board this package knows how to talk to.
//
// Everything it sends is validated on the way out, and everything it receives
// is read back rather than assumed. A component update that silently went to
// the wrong page, or a two-hundred response about a different component, would
// leave a board saying something untrue with nothing anywhere going red.

import { ProviderError } from './errors.js';
import { FetchHttpTransport, type HttpResponse, type HttpTransport } from './http.js';
import type {
  ComponentUpdateReceipt,
  ComponentUpdateRequest,
  StatusBoardProvider,
} from './provider.js';
import type { StatusComponentState } from './types.js';
import {
  assertApiKey,
  assertProviderIdentifier,
  assertTimeout,
  normalizeStatuspageBaseUrl,
} from './validation.js';

const DEFAULT_BASE_URL = 'https://api.statuspage.io';
const DEFAULT_TIMEOUT_MS = 10_000;

const COMPONENT_STATES: readonly StatusComponentState[] = [
  'operational',
  'degraded_performance',
  'major_outage',
];

function isComponentState(value: unknown): value is StatusComponentState {
  return typeof value === 'string' && (COMPONENT_STATES as readonly string[]).includes(value);
}

/**
 * The response has to be about the component we asked about, in the state we
 * asked for. Anything else is a success code attached to something that did not
 * happen.
 */
function parseUpdateResponse(
  response: HttpResponse,
  componentId: string,
  status: StatusComponentState,
): ComponentUpdateReceipt {
  if (typeof response.body !== 'object' || response.body === null || Array.isArray(response.body)) {
    throw new ProviderError(
      'INVALID_RESPONSE',
      'Atlassian Statuspage returned an invalid component response',
    );
  }
  const body = response.body as Record<string, unknown>;
  if (body['id'] !== componentId || !isComponentState(body['status']) || body['status'] !== status) {
    throw new ProviderError(
      'INVALID_RESPONSE',
      'Atlassian Statuspage returned an inconsistent component response',
    );
  }
  return { provider: 'atlassian-statuspage', componentId, status };
}

/** How to reach the board. */
export interface AtlassianStatuspageProviderOptions {
  readonly apiKey: string;
  readonly transport?: HttpTransport;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

/** The board itself. */
export class AtlassianStatuspageProvider implements StatusBoardProvider {
  readonly name = 'atlassian-statuspage';
  readonly #apiKey: string;
  readonly #transport: HttpTransport;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  /** Everything is validated here so nothing invalid can be held between calls. */
  constructor(options: AtlassianStatuspageProviderOptions) {
    this.#apiKey = assertApiKey(options.apiKey);
    this.#transport = options.transport ?? new FetchHttpTransport();
    this.#baseUrl = normalizeStatuspageBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.#timeoutMs = assertTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  /** Set one component's state, and read the answer back before believing it. */
  async updateComponent(request: ComponentUpdateRequest): Promise<ComponentUpdateReceipt> {
    const pageId = assertProviderIdentifier(request.pageId, 'pageId');
    const componentId = assertProviderIdentifier(request.componentId, 'componentId');
    if (!isComponentState(request.status)) {
      throw new ProviderError('INVALID_RESPONSE', 'Unsupported component status');
    }

    let response: HttpResponse;
    try {
      response = await this.#transport.request({
        method: 'PATCH',
        url: `${this.#baseUrl}/v1/pages/${pageId}/components/${componentId}`,
        headers: {
          Accept: 'application/json',
          Authorization: `OAuth ${this.#apiKey}`,
          'Content-Type': 'application/json',
        },
        body: { component: { status: request.status } },
        timeoutMs: this.#timeoutMs,
      });
    } catch (cause) {
      // A thrown transport never produced a response, which is a different
      // thing from a response that said no.
      throw new ProviderError(
        'TRANSPORT_ERROR',
        'Atlassian Statuspage transport failed before a valid response was received',
        { cause },
      );
    }

    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
      throw new ProviderError(
        'HTTP_ERROR',
        `Atlassian Statuspage component update failed with HTTP ${response.status}`,
        { statusCode: response.status },
      );
    }

    return parseUpdateResponse(response, componentId, request.status);
  }
}
