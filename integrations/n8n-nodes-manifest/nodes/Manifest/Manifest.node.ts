import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

type ManifestOperation = 'chatCompletion' | 'createResponse' | 'listModels';
type ManifestHttpMethod = 'GET' | 'POST';

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, '');
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function parseJsonValue(
	value: unknown,
	parameterName: string,
	itemIndex: number,
	node: INode,
): unknown {
	if (typeof value !== 'string') return value;

	const trimmed = value.trim();
	if (!trimmed) return {};

	try {
		return JSON.parse(trimmed) as unknown;
	} catch (error) {
		throw new NodeOperationError(
			node,
			`${parameterName} must be valid JSON: ${errorMessage(error)}`,
			{ itemIndex },
		);
	}
}

function parseJsonObject(
	value: unknown,
	parameterName: string,
	itemIndex: number,
	node: INode,
): IDataObject {
	const parsed = parseJsonValue(value, parameterName, itemIndex, node);
	if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
		throw new NodeOperationError(node, `${parameterName} must be a JSON object`, { itemIndex });
	}
	return parsed as IDataObject;
}

function parseJsonArray(
	value: unknown,
	parameterName: string,
	itemIndex: number,
	node: INode,
): unknown[] {
	const parsed = parseJsonValue(value, parameterName, itemIndex, node);
	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(node, `${parameterName} must be a JSON array`, { itemIndex });
	}
	return parsed;
}

function toOutputJson(value: unknown): JsonObject {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as JsonObject;
	}
	return { data: value } as JsonObject;
}

async function executeManifestOperation(
	executeFunctions: IExecuteFunctions,
	operation: ManifestOperation,
	itemIndex: number,
): Promise<unknown> {
	if (operation === 'listModels') {
		return await requestManifest(executeFunctions, 'GET', '/v1/models');
	}

	if (operation === 'chatCompletion') {
		const model = executeFunctions.getNodeParameter('model', itemIndex) as string;
		const messages = parseJsonArray(
			executeFunctions.getNodeParameter('messages', itemIndex),
			'Messages',
			itemIndex,
			executeFunctions.getNode(),
		);
		const additionalBody = parseJsonObject(
			executeFunctions.getNodeParameter('additionalBody', itemIndex, '{}'),
			'Additional Body',
			itemIndex,
			executeFunctions.getNode(),
		);

		return await requestManifest(executeFunctions, 'POST', '/v1/chat/completions', {
			...additionalBody,
			model,
			messages,
			stream: false,
		});
	}

	if (operation === 'createResponse') {
		const model = executeFunctions.getNodeParameter('model', itemIndex) as string;
		const input = executeFunctions.getNodeParameter('input', itemIndex) as string;
		const additionalBody = parseJsonObject(
			executeFunctions.getNodeParameter('additionalBody', itemIndex, '{}'),
			'Additional Body',
			itemIndex,
			executeFunctions.getNode(),
		);

		return await requestManifest(executeFunctions, 'POST', '/v1/responses', {
			...additionalBody,
			model,
			input,
			stream: false,
		});
	}

	throw new NodeOperationError(executeFunctions.getNode(), `Unsupported operation: ${operation}`, {
		itemIndex,
	});
}

async function requestManifest(
	executeFunctions: IExecuteFunctions,
	method: ManifestHttpMethod,
	path: string,
	body?: IDataObject,
): Promise<unknown> {
	const credentials = await executeFunctions.getCredentials('manifestApi');
	const baseUrl = trimTrailingSlash(String(credentials.baseUrl || 'https://app.manifest.build'));
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		headers: {
			Authorization: `Bearer ${String(credentials.apiKey)}`,
		},
		json: true,
	};

	if (body !== undefined) {
		options.body = body;
	}

	return await executeFunctions.helpers.httpRequest(options);
}

export class Manifest implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Manifest',
		name: 'manifest',
		icon: { light: 'file:manifest-logo.svg', dark: 'file:manifest-logo.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"]}}',
		description: 'Route AI requests through Manifest',
		defaults: {
			name: 'Manifest',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'manifestApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Create Chat Completion',
						value: 'chatCompletion',
						description: 'Call Manifest using the OpenAI-compatible chat completions API',
						action: 'Create a chat completion',
					},
					{
						name: 'Create Response',
						value: 'createResponse',
						description: 'Call Manifest using the OpenAI-compatible Responses API',
						action: 'Create a response',
					},
					{
						name: 'List Models',
						value: 'listModels',
						description: 'List models available to this Manifest API key',
						action: 'List models',
					},
				],
				default: 'chatCompletion',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'auto',
				required: true,
				description: 'Manifest model ID. Use auto to let Manifest route the request.',
				displayOptions: {
					show: {
						operation: ['chatCompletion', 'createResponse'],
					},
				},
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'json',
				default: '[{"role":"user","content":"Hello from n8n"}]',
				required: true,
				description: 'OpenAI-compatible chat messages array',
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
					},
				},
			},
			{
				displayName: 'Input',
				name: 'input',
				type: 'string',
				default: '={{$json.prompt || $json.input || ""}}',
				required: true,
				description: 'Text input for the Responses API call',
				displayOptions: {
					show: {
						operation: ['createResponse'],
					},
				},
			},
			{
				displayName: 'Additional Body',
				name: 'additionalBody',
				type: 'json',
				default: '{}',
				description:
					'Additional JSON fields to merge into the request body. Streaming is disabled for these operations.',
				displayOptions: {
					show: {
						operation: ['chatCompletion', 'createResponse'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as ManifestOperation;
				const response = await executeManifestOperation(this, operation, itemIndex);

				returnData.push({
					json: toOutputJson(response),
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (!this.continueOnFail()) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}

				returnData.push({
					json: { error: errorMessage(error) },
					pairedItem: { item: itemIndex },
				});
			}
		}

		return [returnData];
	}
}
