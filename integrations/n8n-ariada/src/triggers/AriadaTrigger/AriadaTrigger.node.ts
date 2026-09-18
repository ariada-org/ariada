import type {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	IWebhookFunctions,
	ITriggerResponse,
	IWebhookResponseData,
} from 'n8n-workflow';

import { parseWebhookPayload } from '../../lib/boundary';
import { reportToCompletionItem } from '../../lib/report';

export class AriadaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ariada Trigger', name: 'ariadaTrigger', icon: 'file:ariada.svg', group: ['trigger'], version: 1,
		description: 'Start a workflow when an Ariada scan completes', defaults: { name: 'Ariada Trigger' },
		inputs: [], outputs: ['main'], webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'ariada' }], properties: [],
	} as INodeTypeDescription;

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> { return {} as ITriggerResponse; }

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const payload = parseWebhookPayload(this.getBodyData());
		const item = { json: reportToCompletionItem(payload.report) };
		return { workflowData: [[item]] };
	}
}
