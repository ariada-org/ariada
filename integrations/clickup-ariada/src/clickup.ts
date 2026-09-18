import type {
    ClickUpTask,
    ClickUpTaskInput,
    ClickUpTransport,
    ClickUpWebhookRegistration,
} from './types.js';

export class ClickUpRest implements ClickUpTransport {
    private readonly token: string;
    private readonly endpoint: string;

    constructor(token: string, endpoint = 'https://api.clickup.com/api/v2') {
        this.token = token;
        this.endpoint = endpoint;
    }
    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const response = await fetch(`${this.endpoint}${path}`, { ...init, headers: { authorization: this.token, 'content-type': 'application/json', ...init.headers } });
        if (!response.ok)
            throw new Error(`ClickUp API HTTP ${response.status}`);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object')
            throw new Error('ClickUp API returned an invalid response');
        return payload;
    }
    async listTasks(listId: string): Promise<ClickUpTask[]> {
        const payload = await this.request<{ tasks?: ClickUpTask[] }>(`/list/${encodeURIComponent(listId)}/task?include_closed=true`);
        return Array.isArray(payload.tasks) ? payload.tasks : [];
    }
    createTask(listId: string, input: ClickUpTaskInput): Promise<ClickUpTask> {
        return this.request<ClickUpTask>(`/list/${encodeURIComponent(listId)}/task`, { method: 'POST', body: JSON.stringify({ name: input.name, description: input.description, tags: input.tags, custom_fields: input.custom_fields }) });
    }
    createWebhook(
        teamId: string,
        endpoint: string,
        events: string[] = ['taskCreated', 'taskUpdated'],
    ): Promise<ClickUpWebhookRegistration> {
        return this.request<ClickUpWebhookRegistration>(`/team/${encodeURIComponent(teamId)}/webhook`, { method: 'POST', body: JSON.stringify({ endpoint, events }) });
    }
}
