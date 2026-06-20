// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  SandboxBridge,
  type BridgePort,
  type BridgeResponse,
  type SafeElementData,
  type SafeDocumentData,
} from './sandbox-bridge.js';

/**
 * A fake MessagePort that captures outgoing messages and lets the test inject
 * incoming messages without requiring a real browser MessageChannel.
 */
class FakePort implements BridgePort {
  readonly sent: unknown[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;

  postMessage(data: unknown): void {
    this.sent.push(data);
  }

  close(): void {
    // no-op in tests
  }

  /** Simulate the sandbox iframe sending a message back to the bridge. */
  receive(data: BridgeResponse): void {
    this.onmessage?.({ data });
  }
}

const ELEMENT: SafeElementData = {
  backendNodeId: 1,
  nodeName: 'IMG',
  selector: 'img',
  attributes: { src: 'photo.png' },
};

const DOCUMENT: SafeDocumentData = {
  url: 'https://example.com/',
  title: 'Example page',
  lang: 'en',
};

describe('SandboxBridge', () => {
  let port: FakePort;
  let bridge: SandboxBridge;

  beforeEach(() => {
    port = new FakePort();
    bridge = new SandboxBridge(port);
  });

  it('sends a visit_document message when visitDocument is called', () => {
    bridge.visitDocument(DOCUMENT);
    expect(port.sent).toHaveLength(1);
    expect((port.sent[0] as { kind: string }).kind).toBe('visit_document');
    expect((port.sent[0] as { documentData: SafeDocumentData }).documentData).toEqual(DOCUMENT);
  });

  it('sends a visit_element message when visitElement is called', () => {
    const promise = bridge.visitElement(ELEMENT);
    expect(port.sent).toHaveLength(1);
    expect((port.sent[0] as { kind: string }).kind).toBe('visit_element');
    expect((port.sent[0] as { elementData: SafeElementData }).elementData).toEqual(ELEMENT);
    // Resolve to avoid unhandled promise
    port.receive({ kind: 'element_features', features: {} });
    return promise;
  });

  it('resolves visitElement with the features returned by the sandbox', async () => {
    const promise = bridge.visitElement(ELEMENT);
    const features = { 'stub-a11y': { missingAlt: true } };
    port.receive({ kind: 'element_features', features });
    await expect(promise).resolves.toEqual(features);
  });

  it('sends an evaluate message and resolves with the sandbox findings', async () => {
    const features = { 'stub-a11y': { missingAlt: true } };
    const promise = bridge.evaluate(features);
    expect((port.sent[0] as { kind: string }).kind).toBe('evaluate');
    const findings = [{ id: 'img-alt-1', ruleId: 'image-alt', severity: 'serious' }];
    port.receive({ kind: 'findings', findings });
    await expect(promise).resolves.toEqual(findings);
  });

  it('rejects visitElement when the sandbox reports an error', async () => {
    const promise = bridge.visitElement(ELEMENT);
    port.receive({ kind: 'error', message: 'sandbox crashed' });
    await expect(promise).rejects.toThrow('sandbox crashed');
  });

  it('rejects evaluate when the sandbox reports an error', async () => {
    const promise = bridge.evaluate({});
    port.receive({ kind: 'error', message: 'evaluation failed' });
    await expect(promise).rejects.toThrow('evaluation failed');
  });

  it('ignores unknown message kinds without throwing', () => {
    // Simulate an unexpected message kind — the bridge must not throw.
    expect(() => {
      port.receive({ kind: 'ready' });
    }).not.toThrow();
  });

  it('closes the port when close() is called', () => {
    const closeSpy = vi.spyOn(port, 'close');
    bridge.close();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
