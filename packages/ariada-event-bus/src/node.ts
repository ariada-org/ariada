// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertProductEvent, type ProductEvent } from '@ariada-org/event-contracts';
import type { EventPublisher, PublishReceipt } from './index.js';

export class JsonlEventPublisher implements EventPublisher {
    private readonly path: string;
    constructor(path: string) {
        this.path = path;
    }
    async publish(event: ProductEvent): Promise<PublishReceipt> {
        assertProductEvent(event);
        await mkdir(dirname(this.path), { recursive: true });
        await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
        return { eventId: event.id, status: 'published' };
    }
}
