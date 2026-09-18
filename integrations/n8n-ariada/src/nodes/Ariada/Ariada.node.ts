import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { runAriadaCli } from '../../lib/cli';
import { reportToItems } from '../../lib/report';

export class Ariada implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ariada', name: 'ariada', icon: 'file:ariada.svg', group: ['transform'], version: 1,
		description: 'Consume an Ariada accessibility report or run the existing Ariada CLI', defaults: { name: 'Ariada' },
		inputs: ['main'], outputs: ['main'],
		credentials: [{ name: 'ariadaApi', required: false }],
		properties: [
			{ displayName: 'Operation', name: 'operation', type: 'options', options: [{ name: 'Consume Report', value: 'consumeReport' }, { name: 'Run CLI Scan', value: 'scanReport' }], default: 'consumeReport' },
			{ displayName: 'Report JSON', name: 'reportJson', type: 'json', default: '={}', displayOptions: { show: { operation: ['consumeReport'] } } },
			{ displayName: 'CLI Executable', name: 'cliPath', type: 'string', default: '@ariada-org/cli', displayOptions: { show: { operation: ['scanReport'] } } },
			{ displayName: 'CLI Arguments (JSON)', name: 'cliArgs', type: 'json', default: '[]', displayOptions: { show: { operation: ['scanReport'] } } },
		],
	} as INodeTypeDescription;

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const report = operation === 'scanReport'
			? runAriadaCli({ executable: this.getNodeParameter('cliPath', 0) as string, args: JSON.parse(this.getNodeParameter('cliArgs', 0) as string) })
			: JSON.parse(this.getNodeParameter('reportJson', 0) as string);
		return [reportToItems(report).map((item) => ({ json: item }))];
	}
}
