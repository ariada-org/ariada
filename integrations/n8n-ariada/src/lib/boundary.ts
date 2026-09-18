import { isRecord, type AriadaWebhookPayload } from './contracts';
import { normalizeReport } from './report';

export function parseReportJson(input: string): ReturnType<typeof normalizeReport> { return normalizeReport(JSON.parse(input)); }

// The webhook is the one entry a stranger can reach, so its shape is checked
// before anything reads it — the event must be the one this trigger is for, and
// the report must be present, rather than arriving as undefined further in.
export function parseWebhookPayload(input: unknown): AriadaWebhookPayload {
	if (!isRecord(input) || input.event !== 'scan.completed' || !('report' in input))
		throw new Error('Invalid Ariada webhook: event must be scan.completed and report is required');
	const report = normalizeReport(input.report);
	return { event: 'scan.completed', report };
}

export function createWebhookBoundary(handler: (payload: AriadaWebhookPayload) => Promise<unknown> | unknown): (body: unknown) => Promise<unknown> {
	return async (body: unknown) => handler(parseWebhookPayload(body));
}
