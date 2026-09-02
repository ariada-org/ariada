// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Sandbox bridge: drives a domain module that runs inside a sandboxed iframe.
// The module code has no access to chrome.* APIs, the extension storage, or the
// live DOM. It communicates with the extension via a strict postMessage protocol
// on a MessageChannel, receiving serialised element data and returning extracted
// features and findings.
//
// This file must never import Node.js modules — it runs in browser context only.

/**
 * Serialisable subset of element data passed to the sandboxed module on each
 * element visit. No live DOM references, no window, no document — only the
 * data the element's attributes and computed role expose.
 */
export interface SafeElementData {
  readonly backendNodeId: number;
  readonly nodeName: string;
  readonly selector: string;
  readonly attributes: Record<string, string>;
}

/** Serialisable document-level data sent once before element visits. */
export interface SafeDocumentData {
  readonly url: string;
  readonly title: string;
  readonly lang: string;
}

/** Messages the bridge sends into the sandboxed iframe. */
export type BridgeRequest =
  | { readonly kind: 'visit_element'; readonly elementData: SafeElementData }
  | { readonly kind: 'visit_document'; readonly documentData: SafeDocumentData }
  | { readonly kind: 'evaluate'; readonly features: Record<string, unknown> }
  | { readonly kind: 'reset' };

/** Messages the sandboxed iframe sends back to the bridge. */
export type BridgeResponse =
  | { readonly kind: 'element_features'; readonly features: Record<string, unknown> }
  | { readonly kind: 'findings'; readonly findings: unknown[] }
  | { readonly kind: 'ready' }
  | { readonly kind: 'error'; readonly message: string };

/**
 * A minimal interface representing the MessagePort side used by the bridge.
 * Keeping this as an interface rather than depending on a global type lets tests
 * inject a fake MessageChannel without requiring a browser runtime.
 */
export interface BridgePort {
  postMessage(data: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

/**
 * Manages the postMessage protocol between the extension and one sandboxed
 * local-file module. Create one SandboxBridge instance per loaded local-file
 * module; the bridge holds the port and dispatches calls in order.
 *
 * This class is intentionally free of chrome.* APIs so it can be unit-tested
 * without the extension runtime.
 */
export class SandboxBridge {
  private readonly _port: BridgePort;
  private _pendingResolve: ((value: Record<string, unknown>) => void) | null = null;
  private _pendingReject: ((reason: unknown) => void) | null = null;
  private _findingsResolve: ((value: unknown[]) => void) | null = null;
  private _findingsReject: ((reason: unknown) => void) | null = null;

  /**
   *
   */
  constructor(port: BridgePort) {
    this._port = port;
    this._port.onmessage = (event) => this._handleMessage(event.data);
  }

  /**
   * Notify the sandboxed module of document-level data before starting element
   * visits. The promise resolves when the module acknowledges (via any response)
   * or after a short timeout.
   */
  visitDocument(documentData: SafeDocumentData): void {
    const msg: BridgeRequest = { kind: 'visit_document', documentData };
    this._port.postMessage(msg);
  }

  /**
   * Send one element's data to the sandboxed module and wait for the feature
   * extraction response. Returns the features the module extracted (may be an
   * empty object if the module does not handle this element type).
   */
  visitElement(elementData: SafeElementData): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      this._pendingResolve = resolve;
      this._pendingReject = reject;
      const msg: BridgeRequest = { kind: 'visit_element', elementData };
      this._port.postMessage(msg);
    });
  }

  /**
   * Signal to the sandboxed module that all elements have been visited and it
   * should now evaluate its accumulated features and return findings.
   */
  evaluate(features: Record<string, unknown>): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      this._findingsResolve = resolve;
      this._findingsReject = reject;
      const msg: BridgeRequest = { kind: 'evaluate', features };
      this._port.postMessage(msg);
    });
  }

  /** Close the bridge and the underlying port. */
  close(): void {
    this._port.close();
  }

  private _handleMessage(data: unknown): void {
    if (!isBridgeResponse(data)) return;

    switch (data.kind) {
      case 'element_features':
        if (this._pendingResolve) {
          const resolve = this._pendingResolve;
          this._pendingResolve = null;
          this._pendingReject = null;
          resolve(data.features as Record<string, unknown>);
        }
        break;

      case 'findings':
        if (this._findingsResolve) {
          const resolve = this._findingsResolve;
          this._findingsResolve = null;
          this._findingsReject = null;
          resolve(data.findings);
        }
        break;

      case 'error': {
        const message = data.message;
        if (this._pendingReject) {
          const reject = this._pendingReject;
          this._pendingResolve = null;
          this._pendingReject = null;
          reject(new Error(message));
        } else if (this._findingsReject) {
          const reject = this._findingsReject;
          this._findingsResolve = null;
          this._findingsReject = null;
          reject(new Error(message));
        }
        break;
      }

      case 'ready':
        // The sandbox iframe signals readiness — no action needed here; the
        // bridge is already wired and ready to send requests.
        break;
    }
  }
}

function isBridgeResponse(data: unknown): data is BridgeResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { kind?: unknown }).kind === 'string'
  );
}
