// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
    assertProductEvent,
    type ProductEvent,
    type ProductEventType,
} from '@ariada-org/event-contracts';

export interface PublishReceipt {
    eventId: string;
    status: 'published' | 'queued' | 'skipped';
    sequence?: number;
}

export interface EventPublisher {
    publish(event: ProductEvent): Promise<PublishReceipt>;
}

export interface EventHandlerContext {
    deliveryCount: number;
    streamSequence?: number;
}

export type EventHandler = (
    event: ProductEvent,
    context: EventHandlerContext,
) => Promise<void>;

export interface SubscribeOptions {
    durableName: string;
    eventTypes?: readonly ProductEventType[];
    handler: EventHandler;
    startSequence?: number;
    startTime?: Date;
    maxDeliver?: number;
}

export interface EventSubscription {
    close(): Promise<void>;
}

export interface EventBus extends EventPublisher {
    subscribe(options: SubscribeOptions): Promise<EventSubscription>;
}

export class NoopEventPublisher implements EventPublisher {
    async publish(event: ProductEvent): Promise<PublishReceipt> {
        return { eventId: event.id, status: 'skipped' };
    }
}
export class InMemoryEventBus implements EventBus {
    #handlers = new Map<string, SubscribeOptions>();
    async publish(event: ProductEvent): Promise<PublishReceipt> {
        assertProductEvent(event);
        for (const subscription of this.#handlers.values()) {
            if (subscription.eventTypes?.includes(event.type) === false)
                continue;
            await subscription.handler(event, { deliveryCount: 1 });
        }
        return { eventId: event.id, status: 'published' };
    }
    async subscribe(options: SubscribeOptions): Promise<EventSubscription> {
        if (this.#handlers.has(options.durableName)) {
            throw new Error(`subscription already exists: ${options.durableName}`);
        }
        this.#handlers.set(options.durableName, options);
        return {
            close: async () => {
                this.#handlers.delete(options.durableName);
            },
        };
    }
}
export interface HttpEventPublisherOptions {
    endpoint: string;
    token: string;
    fetch?: typeof globalThis.fetch;
}

export class HttpEventPublisher implements EventPublisher {
    #endpoint: string;
    #token: string;
    #fetch: typeof globalThis.fetch;
    constructor(options: HttpEventPublisherOptions) {
        this.#endpoint = options.endpoint.endsWith('/api/events')
            ? options.endpoint
            : `${options.endpoint.replace(/\/$/, '')}/api/events`;
        this.#token = options.token;
        this.#fetch = options.fetch ?? globalThis.fetch;
    }
    async publish(event: ProductEvent): Promise<PublishReceipt> {
        assertProductEvent(event);
        const response = await this.#fetch(this.#endpoint, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${this.#token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(event),
        });
        if (!response.ok) {
            throw new Error(`event ingress rejected ${event.id}: HTTP ${response.status}`);
        }
        return (await response.json()) as PublishReceipt;
    }
}
export class FanoutEventPublisher implements EventPublisher {
    private readonly publishers: readonly EventPublisher[];
    constructor(publishers: readonly EventPublisher[]) {
        this.publishers = publishers;
    }
    async publish(event: ProductEvent): Promise<PublishReceipt> {
        if (this.publishers.length === 0) {
            return { eventId: event.id, status: 'skipped' };
        }
        const receipts = await Promise.all(this.publishers.map((publisher) => publisher.publish(event)));
        return (receipts.find((receipt) => receipt.status === 'published') ??
            receipts[0] ?? { eventId: event.id, status: 'skipped' });
    }
}
