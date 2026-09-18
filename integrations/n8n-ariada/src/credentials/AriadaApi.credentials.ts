import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class AriadaApi implements ICredentialType {
	name = 'ariadaApi';
	displayName = 'Ariada API';
	documentationUrl = 'https://github.com/ariada-org/ariada';
	properties: INodeProperties[] = [
		{ displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'https://ariada.example.invalid', required: true },
		// Both secrets are marked as passwords, so the editor masks them and they
		// do not appear in an exported workflow the way a plain field would.
		{ displayName: 'API Token', name: 'apiToken', type: 'string', typeOptions: { password: true }, default: '', required: true },
		{ displayName: 'Webhook Secret', name: 'webhookSecret', type: 'string', typeOptions: { password: true }, default: '' },
	];
}
