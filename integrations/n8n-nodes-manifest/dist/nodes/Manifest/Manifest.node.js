"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manifest = void 0;
const n8n_workflow_1 = require("n8n-workflow");
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function parseJsonValue(value, parameterName, itemIndex, node) {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    if (!trimmed)
        return {};
    try {
        return JSON.parse(trimmed);
    }
    catch (error) {
        throw new n8n_workflow_1.NodeOperationError(node, `${parameterName} must be valid JSON: ${errorMessage(error)}`, { itemIndex });
    }
}
function parseJsonObject(value, parameterName, itemIndex, node) {
    const parsed = parseJsonValue(value, parameterName, itemIndex, node);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new n8n_workflow_1.NodeOperationError(node, `${parameterName} must be a JSON object`, { itemIndex });
    }
    return parsed;
}
function parseJsonArray(value, parameterName, itemIndex, node) {
    const parsed = parseJsonValue(value, parameterName, itemIndex, node);
    if (!Array.isArray(parsed)) {
        throw new n8n_workflow_1.NodeOperationError(node, `${parameterName} must be a JSON array`, { itemIndex });
    }
    return parsed;
}
function toOutputJson(value) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return { data: value };
}
async function executeManifestOperation(executeFunctions, operation, itemIndex) {
    if (operation === 'listModels') {
        return await requestManifest(executeFunctions, 'GET', '/v1/models');
    }
    if (operation === 'chatCompletion') {
        const model = executeFunctions.getNodeParameter('model', itemIndex);
        const messages = parseJsonArray(executeFunctions.getNodeParameter('messages', itemIndex), 'Messages', itemIndex, executeFunctions.getNode());
        const additionalBody = parseJsonObject(executeFunctions.getNodeParameter('additionalBody', itemIndex, '{}'), 'Additional Body', itemIndex, executeFunctions.getNode());
        return await requestManifest(executeFunctions, 'POST', '/v1/chat/completions', {
            ...additionalBody,
            model,
            messages,
            stream: false,
        });
    }
    if (operation === 'createResponse') {
        const model = executeFunctions.getNodeParameter('model', itemIndex);
        const input = executeFunctions.getNodeParameter('input', itemIndex);
        const additionalBody = parseJsonObject(executeFunctions.getNodeParameter('additionalBody', itemIndex, '{}'), 'Additional Body', itemIndex, executeFunctions.getNode());
        return await requestManifest(executeFunctions, 'POST', '/v1/responses', {
            ...additionalBody,
            model,
            input,
            stream: false,
        });
    }
    throw new n8n_workflow_1.NodeOperationError(executeFunctions.getNode(), `Unsupported operation: ${operation}`, {
        itemIndex,
    });
}
async function requestManifest(executeFunctions, method, path, body) {
    const credentials = await executeFunctions.getCredentials('manifestApi');
    const baseUrl = trimTrailingSlash(String(credentials.baseUrl || 'https://app.manifest.build'));
    const options = {
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
class Manifest {
    constructor() {
        this.description = {
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
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
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
                    description: 'Additional JSON fields to merge into the request body. Streaming is disabled for these operations.',
                    displayOptions: {
                        show: {
                            operation: ['chatCompletion', 'createResponse'],
                        },
                    },
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const response = await executeManifestOperation(this, operation, itemIndex);
                returnData.push({
                    json: toOutputJson(response),
                    pairedItem: { item: itemIndex },
                });
            }
            catch (error) {
                if (!this.continueOnFail()) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
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
exports.Manifest = Manifest;
//# sourceMappingURL=Manifest.node.js.map