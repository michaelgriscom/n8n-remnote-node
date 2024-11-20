import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import WebSocket from 'ws';

export class RemNote implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RemNote',
		name: 'remNote',
		icon: 'file:RemNote.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Create and manage RemNote entries via plugin',
		defaults: {
			name: 'RemNote',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Create Rem',
						value: 'createRem',
						description: 'Create a new rem',
					},
				],
				default: 'createRem',
				noDataExpression: true,
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				default: '',
				description: 'The content of the rem',
				required: true,
				displayOptions: {
					show: {
						operation: ['createRem'],
					},
				},
			},
			{
				displayName: 'Parent Rem ID',
				name: 'parentId',
				type: 'string',
				default: '',
				description: 'ID of the parent rem (optional)',
				required: false,
				displayOptions: {
					show: {
						operation: ['createRem'],
					},
				},
			},
			{
				displayName: 'Plugin WebSocket Port',
				name: 'port',
				type: 'number',
				default: 3333,
				description: 'Port number where the RemNote plugin is listening',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const port = this.getNodeParameter('port', 0) as number;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'createRem') {
					const content = this.getNodeParameter('content', i) as string;
					const parentId = this.getNodeParameter('parentId', i) as string;

					await new Promise<void>((resolve, reject) => {
						const ws = new WebSocket(`ws://localhost:${port}`);

						ws.on('error', (error) => {
							ws.close();
							reject(new Error(`WebSocket error: ${error.message}`));
						});

						ws.on('open', () => {
							ws.send(JSON.stringify({
								action: 'createRem',
								text: content,
								parentId: parentId || null,
							}));
						});

						ws.on('message', (data) => {
							try {
								const response = JSON.parse(data.toString());
								if (response.success) {
									returnData.push({
										json: response,
									});
									ws.close();
									resolve();
								} else {
									ws.close();
									reject(new Error(response.error));
								}
							} catch (error) {
								ws.close();
								reject(new Error(`Failed to parse response: ${error.message}`));
							}
						});

						// Add timeout
						setTimeout(() => {
							ws.close();
							reject(new Error('WebSocket connection timed out'));
						}, 10000); // 10 second timeout
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}