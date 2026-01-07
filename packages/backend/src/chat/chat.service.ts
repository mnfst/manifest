import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { FlowEntity } from '../flow/flow.entity';
import { McpToolService } from '../mcp/mcp.tool';
import { FlowExecutionService } from '../flow-execution/flow-execution.service';
import type {
  ModelListResponse,
  ValidateKeyResponse,
  PreviewChatRequest,
  ChatStreamEvent,
  UserIntentNodeParameters,
} from '@chatgpt-app-builder/shared';

/**
 * Chat service for LLM preview functionality
 * Handles model listing, API key validation, and chat streaming with tool access
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    private readonly mcpToolService: McpToolService,
    private readonly flowExecutionService: FlowExecutionService,
  ) {}

  /**
   * Returns list of available LLM models
   * Currently supports OpenAI models only
   */
  async getModels(): Promise<ModelListResponse> {
    return {
      models: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'openai',
          description: 'Most capable model, best for complex tasks',
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          provider: 'openai',
          description: 'Fast and cost-effective for simpler tasks',
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'openai',
          description: 'Previous generation, high capability',
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          description: 'Fast and economical',
        },
      ],
    };
  }

  /**
   * Validates an OpenAI API key
   * Checks format and tests with a minimal API call
   */
  async validateApiKey(apiKey: string): Promise<ValidateKeyResponse> {
    // Format check: OpenAI keys start with 'sk-'
    if (!apiKey.startsWith('sk-')) {
      return {
        valid: false,
        error: 'Invalid API key format. OpenAI keys start with "sk-"',
      };
    }

    // Test with OpenAI API - will be implemented in US1
    // For now, just check format
    try {
      // TODO: Implement actual API validation in T016
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate API key',
      };
    }
  }

  /**
   * Streams a chat response from OpenAI with MCP tool access
   * Converts UserIntent nodes from the flow into LangChain tools
   */
  streamChat(request: PreviewChatRequest, apiKey: string): Observable<ChatStreamEvent> {
    const subject = new Subject<ChatStreamEvent>();

    this.executeStreamChat(request, apiKey, subject).catch((error) => {
      subject.next({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      subject.complete();
    });

    return subject.asObservable();
  }

  /**
   * Execute the streaming chat with tool calling
   */
  private async executeStreamChat(
    request: PreviewChatRequest,
    apiKey: string,
    subject: Subject<ChatStreamEvent>,
  ): Promise<void> {
    const messageId = `msg_${Date.now()}`;
    subject.next({ type: 'start', messageId });

    // Get flow and build tools from UserIntent nodes
    const flow = await this.flowRepository.findOne({
      where: { id: request.flowId },
      relations: ['app'],
    });

    if (!flow) {
      throw new NotFoundException(`Flow not found: ${request.flowId}`);
    }

    // Build LangChain tools from UserIntent nodes
    const tools = await this.buildToolsFromFlow(flow);

    // Create ChatOpenAI instance with streaming
    const model = new ChatOpenAI({
      modelName: request.model,
      openAIApiKey: apiKey,
      streaming: true,
    });

    // Bind tools if any exist
    const modelWithTools = tools.length > 0 ? model.bindTools(tools) : model;

    // Convert request messages to LangChain messages
    const messages = request.messages.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      } else if (msg.role === 'tool' && msg.toolResult) {
        return new ToolMessage({
          content: msg.toolResult.content,
          tool_call_id: msg.toolResult.toolCallId,
        });
      }
      return new HumanMessage(msg.content);
    });

    // Add system message with context about available tools
    if (tools.length > 0) {
      const toolDescriptions = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
      messages.unshift(new SystemMessage(
        `You are a helpful assistant with access to the following tools:\n${toolDescriptions}\n\nUse these tools when appropriate to help the user.`
      ));
    }

    // Stream the response
    const stream = await modelWithTools.stream(messages);

    const pendingToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    for await (const chunk of stream) {
      // Handle text content
      if (chunk.content && typeof chunk.content === 'string') {
        subject.next({ type: 'token', content: chunk.content });
      }

      // Handle tool calls
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        for (const toolCall of chunk.tool_calls) {
          if (toolCall.name && toolCall.id) {
            const tc = {
              id: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.args as Record<string, unknown> || {},
            };
            pendingToolCalls.push(tc);
            subject.next({ type: 'tool_call', toolCall: tc });
          }
        }
      }
    }

    // Execute tool calls if any
    for (const toolCall of pendingToolCalls) {
      try {
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
          const result = await tool.invoke(toolCall.arguments);
          subject.next({
            type: 'tool_result',
            toolResult: {
              toolCallId: toolCall.id,
              name: toolCall.name,
              content: typeof result === 'string' ? result : JSON.stringify(result),
              success: true,
            },
          });
        }
      } catch (error) {
        subject.next({
          type: 'tool_result',
          toolResult: {
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: '',
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
          },
        });
      }
    }

    subject.next({ type: 'end', messageId });
    subject.complete();
  }

  /**
   * Build LangChain tools from UserIntent nodes in a flow
   */
  private async buildToolsFromFlow(flow: FlowEntity): Promise<DynamicStructuredTool[]> {
    const nodes = flow.nodes ?? [];
    const tools: DynamicStructuredTool[] = [];

    for (const node of nodes) {
      if (node.type === 'UserIntent') {
        const params = node.parameters as UserIntentNodeParameters;

        // Skip inactive triggers
        if (params.isActive === false) continue;

        // Build Zod schema from trigger parameters
        const schemaObj: Record<string, z.ZodTypeAny> = {};
        const triggerParams = params.parameters ?? [];

        if (triggerParams.length === 0) {
          // Default schema with just message
          schemaObj['message'] = z.string().describe('User query or request');
        } else {
          for (const param of triggerParams) {
            let fieldSchema: z.ZodTypeAny;
            switch (param.type) {
              case 'number':
                fieldSchema = z.number();
                break;
              case 'boolean':
                fieldSchema = z.boolean();
                break;
              default:
                fieldSchema = z.string();
            }
            if (param.description) {
              fieldSchema = fieldSchema.describe(param.description);
            }
            if (!param.required) {
              fieldSchema = fieldSchema.optional();
            }
            schemaObj[param.name] = fieldSchema;
          }
        }

        const tool = new DynamicStructuredTool({
          name: params.toolName,
          description: params.toolDescription || `Execute the ${node.name} action`,
          schema: z.object(schemaObj),
          func: async (input: Record<string, unknown>) => {
            // Create preview execution record
            const execution = await this.flowExecutionService.createExecution({
              flowId: flow.id,
              flowName: flow.name,
              flowToolName: params.toolName,
              initialParams: input,
              isPreview: true,
            });

            try {
              let result: string;
              // Execute via MCP tool service if app is published
              if (flow.app?.slug && flow.app?.status === 'published') {
                try {
                  const mcpResult = await this.mcpToolService.executeTool(
                    flow.app.slug,
                    params.toolName,
                    input,
                  );
                  result = mcpResult.content.map(c => c.text).join('\n');
                } catch (error) {
                  result = `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
              } else {
                // For unpublished apps, return a placeholder response
                result = `Tool "${params.toolName}" executed with input: ${JSON.stringify(input)}. Note: App is not published, so this is a simulated response.`;
              }

              // Mark execution as fulfilled
              await this.flowExecutionService.updateExecution(execution.id, {
                status: 'fulfilled',
                endedAt: new Date(),
                nodeExecutions: [{
                  nodeId: node.id,
                  nodeName: node.name,
                  nodeType: node.type,
                  executedAt: new Date().toISOString(),
                  inputData: input,
                  outputData: { result },
                  status: 'completed',
                }],
              });

              return result;
            } catch (error) {
              // Mark execution as error
              await this.flowExecutionService.updateExecution(execution.id, {
                status: 'error',
                endedAt: new Date(),
                errorInfo: {
                  message: error instanceof Error ? error.message : 'Unknown error',
                  nodeId: node.id,
                  nodeName: node.name,
                },
              });
              throw error;
            }
          },
        });

        tools.push(tool);
      }
    }

    return tools;
  }
}
