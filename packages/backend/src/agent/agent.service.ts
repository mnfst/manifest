import { Injectable } from '@nestjs/common';
import type { App, LayoutTemplate, ThemeVariables, MockData, NodeInstance, InterfaceNodeParameters } from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES, isTableMockData } from '@chatgpt-app-builder/shared';
import { createLLM, getCurrentProvider } from './llm';
import { z } from 'zod';
import {
  layoutSelectorTool,
  toolGeneratorTool,
  themeGeneratorTool,
  mockDataGeneratorTool,
} from './tools';

/**
 * Result of app generation from prompt
 */
export interface GenerateAppResult {
  name: string;
  description: string;
  layoutTemplate: LayoutTemplate;
  themeVariables: ThemeVariables;
  mockData: MockData;
  toolName: string;
  toolDescription: string;
}

/**
 * Result of flow generation from prompt
 */
export interface GenerateFlowResult {
  name: string;
  description: string;
  toolName: string;
  toolDescription: string;
  whenToUse: string;
  whenNotToUse: string;
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
}

/**
 * Result of chat processing
 */
export interface ProcessChatResult {
  response: string;
  updates: Partial<App>;
  changes: string[];
}

/**
 * Result of interface node chat processing
 * Updates are applied to the node's InterfaceNodeParameters
 */
export interface ProcessInterfaceNodeChatResult {
  response: string;
  updates: Partial<InterfaceNodeParameters>;
  changes: string[];
}

/**
 * Result of mock data chat processing
 */
export interface ProcessMockDataChatResult {
  response: string;
  mockData: MockData;
}

/**
 * Agent service for LangChain-powered operations
 * Orchestrates tools for app generation and customization
 */
@Injectable()
export class AgentService {
  private llm;

  constructor() {
    // Initialize LLM with current provider
    this.llm = createLLM(getCurrentProvider());
  }

  /**
   * Generate a new app from a user prompt
   * Executes: layout selection → tool generation → theme generation → mock data generation
   */
  async generateApp(prompt: string): Promise<GenerateAppResult> {
    // Step 1: Select layout template
    const layoutResult = await layoutSelectorTool.invoke({ prompt });
    const layoutData = JSON.parse(layoutResult);
    const layoutTemplate: LayoutTemplate = layoutData.layout;

    // Step 2: Generate tool configuration
    const toolResult = await toolGeneratorTool.invoke({ prompt, layoutTemplate });
    const toolData = JSON.parse(toolResult);

    // Step 3: Generate theme variables
    const themeResult = await themeGeneratorTool.invoke({ prompt });
    const themeData = JSON.parse(themeResult);
    const themeVariables: ThemeVariables = {
      ...DEFAULT_THEME_VARIABLES,
      ...themeData.themeVariables,
    };

    // Step 4: Generate mock data
    const mockResult = await mockDataGeneratorTool.invoke({ prompt, layoutTemplate });
    const mockDataResult = JSON.parse(mockResult);
    const mockData: MockData = mockDataResult.mockData;

    return {
      name: toolData.appName,
      description: toolData.appDescription,
      layoutTemplate,
      themeVariables,
      mockData,
      toolName: toolData.toolName,
      toolDescription: toolData.toolDescription,
    };
  }

  /**
   * @deprecated This method is no longer used. Flow creation now uses simplified
   * name/description input with auto-generated tool names. User intent and views
   * are added separately after flow creation.
   */
  async generateFlow(_prompt: string): Promise<GenerateFlowResult> {
    throw new Error('generateFlow is deprecated. Use simplified flow creation instead.');
  }

  /**
   * Process a chat message for app customization
   * Uses LLM to interpret the message and determine updates
   */
  async processChat(message: string, currentApp: App): Promise<ProcessChatResult> {
    // Define schema for structured LLM output
    const configUpdateSchema = z.object({
      layoutTemplate: z.enum(['table', 'post-list']).optional().describe('New layout template if user wants to change it'),
      primaryColor: z.string().optional().describe('New primary color in HSL format (e.g., "221 83% 53%" for blue) if user wants to change colors'),
      backgroundColor: z.enum(['dark', 'light']).optional().describe('Background theme if user wants dark or light mode'),
      toolName: z.string().optional().describe('New tool name if user wants to rename it (snake_case)'),
      toolDescription: z.string().optional().describe('New tool description if user wants to update it'),
      changes: z.array(z.string()).describe('List of changes being made'),
      response: z.string().describe('Friendly response to the user explaining what was changed'),
      understood: z.boolean().describe('Whether the request was understood and actionable'),
    });

    // Create structured output LLM
    const structuredLLM = this.llm.withStructuredOutput(configUpdateSchema);

    // Build the prompt with current app context
    const systemPrompt = `You are an assistant helping users customize their app configuration.

Current app configuration:
- Layout: ${currentApp.layoutTemplate}
- Tool name: ${currentApp.toolName}
- Tool description: ${currentApp.toolDescription}
- Primary color: ${currentApp.themeVariables['--primary'] || 'default blue'}

Available layouts: "table" (for tabular data), "post-list" (for blog/article style content)

Available colors (use HSL format):
- blue: "221 83% 53%"
- red: "0 84% 60%"
- green: "142 76% 36%"
- purple: "262 83% 58%"
- orange: "24 95% 53%"
- yellow: "47 96% 53%"
- pink: "330 81% 60%"
- teal: "172 66% 50%"
- indigo: "239 84% 67%"

Analyze the user's message and determine what configuration changes they want. If you can't understand the request, set understood=false and provide a helpful response explaining what you can do.`;

    try {
      const result = await structuredLLM.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]);

      // Debug logging
      console.log('🤖 LLM Response:', JSON.stringify(result, null, 2));

      const updates: Partial<App> = {};
      const changes: string[] = result.changes || [];

      // Apply layout change
      if (result.layoutTemplate && result.layoutTemplate !== currentApp.layoutTemplate) {
        updates.layoutTemplate = result.layoutTemplate;
      }

      // Apply color changes
      if (result.primaryColor || result.backgroundColor) {
        const themeUpdates: ThemeVariables = { ...currentApp.themeVariables };

        if (result.primaryColor) {
          themeUpdates['--primary'] = result.primaryColor;
          // Set appropriate foreground color
          const lightColors = ['47 96% 53%', '0 0% 100%', '210 40% 96.1%'];
          themeUpdates['--primary-foreground'] = lightColors.includes(result.primaryColor)
            ? '222.2 47.4% 11.2%'
            : '210 40% 98%';
        }

        if (result.backgroundColor === 'dark') {
          themeUpdates['--background'] = '222.2 47.4% 11.2%';
          themeUpdates['--foreground'] = '210 40% 98%';
          themeUpdates['--card'] = '222.2 47.4% 15%';
          themeUpdates['--card-foreground'] = '210 40% 98%';
          themeUpdates['--muted'] = '217.2 32.6% 17.5%';
          themeUpdates['--muted-foreground'] = '215 20.2% 65.1%';
        } else if (result.backgroundColor === 'light') {
          themeUpdates['--background'] = '0 0% 100%';
          themeUpdates['--foreground'] = '222.2 47.4% 11.2%';
          themeUpdates['--card'] = '0 0% 100%';
          themeUpdates['--card-foreground'] = '222.2 47.4% 11.2%';
        }

        updates.themeVariables = themeUpdates;
      }

      // Apply tool name change
      if (result.toolName) {
        updates.toolName = result.toolName.toLowerCase().replace(/\s+/g, '_');
      }

      // Apply tool description change
      if (result.toolDescription) {
        updates.toolDescription = result.toolDescription;
      }

      // If layout changed, regenerate mock data for new layout
      if (updates.layoutTemplate) {
        const mockResult = await mockDataGeneratorTool.invoke({
          prompt: currentApp.systemPrompt,
          layoutTemplate: updates.layoutTemplate,
        });
        const mockDataResult = JSON.parse(mockResult);
        updates.mockData = mockDataResult.mockData;
      }

      // Debug: log final updates
      console.log('📝 Updates to apply:', JSON.stringify(updates, null, 2));
      console.log('📋 Changes:', changes);

      return {
        response: result.response,
        updates,
        changes,
      };
    } catch (error) {
      console.error('LLM chat error:', error);
      return {
        response: `I encountered an error processing your request. You can ask me to:
• Change the layout (e.g., "switch to table layout")
• Update colors (e.g., "change primary color to blue")
• Modify the tool name (e.g., "rename tool to search_products")
• Update the tool description`,
        updates: {},
        changes: [],
      };
    }
  }

  /**
   * Process a chat message for Interface node customization
   * Uses LLM to interpret the message and update node parameters
   */
  async processInterfaceNodeChat(message: string, currentNode: NodeInstance): Promise<ProcessInterfaceNodeChatResult> {
    const params = currentNode.parameters as InterfaceNodeParameters;

    // Define schema for structured LLM output
    const nodeUpdateSchema = z.object({
      layoutTemplate: z.enum(['table', 'post-list']).optional().describe('New layout template if user wants to change it'),
      mockDataUpdate: z.object({
        action: z.enum(['replace', 'add_column', 'remove_column', 'add_row', 'update_rows']).optional(),
        columns: z.array(z.object({
          key: z.string(),
          header: z.string(),
          type: z.enum(['text', 'number', 'date', 'badge', 'action']),
        })).optional(),
        rows: z.array(z.record(z.unknown())).optional(),
      }).optional().describe('Updates to mock data if user wants to modify the data structure'),
      changes: z.array(z.string()).describe('List of changes being made'),
      response: z.string().describe('Friendly response to the user explaining what was changed'),
      understood: z.boolean().describe('Whether the request was understood and actionable'),
    });

    // Create structured output LLM
    const structuredLLM = this.llm.withStructuredOutput(nodeUpdateSchema);

    // Build the prompt with current node context
    let mockDataSummary = 'No data';
    if (params.mockData && isTableMockData(params.mockData)) {
      mockDataSummary = `Columns: ${params.mockData.columns.map((c: { header: string; key: string }) => `${c.header} (${c.key})`).join(', ')}\nRows: ${params.mockData.rows?.length || 0} items`;
    } else if (params.mockData && 'posts' in params.mockData) {
      mockDataSummary = `Posts: ${params.mockData.posts.length} items`;
    } else if (params.mockData) {
      mockDataSummary = `Data: ${JSON.stringify(params.mockData).slice(0, 100)}...`;
    }

    const systemPrompt = `You are an assistant helping users customize their Interface node configuration.

Current node configuration:
- Name: ${currentNode.name || 'Untitled'}
- Layout: ${params.layoutTemplate}
- Mock Data:
  ${mockDataSummary}

Available layouts: "table" (for tabular data), "post-list" (for blog/article style content)

For table layout, columns can have types: text, number, date, badge, action

Analyze the user's message and determine what changes they want to make. You can:
1. Change the layout template
2. Add/remove/modify columns (for table layout)
3. Add/modify sample data rows
4. Update the data structure

If you can't understand the request, set understood=false and provide a helpful response.`;

    try {
      const result = await structuredLLM.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]);

      // Debug logging
      console.log('🤖 Interface Node LLM Response:', JSON.stringify(result, null, 2));

      const updates: Partial<InterfaceNodeParameters> = {};
      const changes: string[] = result.changes || [];

      // Apply layout change
      if (result.layoutTemplate && result.layoutTemplate !== params.layoutTemplate) {
        updates.layoutTemplate = result.layoutTemplate;

        // If layout changed, regenerate appropriate mock data
        const mockResult = await mockDataGeneratorTool.invoke({
          prompt: message,
          layoutTemplate: result.layoutTemplate,
        });
        const mockDataResult = JSON.parse(mockResult);
        updates.mockData = mockDataResult.mockData;
      }

      // Apply mock data updates (if not already changed by layout switch)
      if (!updates.mockData && result.mockDataUpdate && params.mockData && isTableMockData(params.mockData)) {
        const currentMockData = { ...params.mockData };

        if (result.mockDataUpdate.action === 'replace' && result.mockDataUpdate.columns) {
          currentMockData.columns = result.mockDataUpdate.columns;
          if (result.mockDataUpdate.rows) {
            currentMockData.rows = result.mockDataUpdate.rows;
          }
          updates.mockData = currentMockData;
        } else if (result.mockDataUpdate.action === 'add_column' && result.mockDataUpdate.columns) {
          currentMockData.columns = [...currentMockData.columns, ...result.mockDataUpdate.columns];
          updates.mockData = currentMockData;
        } else if (result.mockDataUpdate.action === 'update_rows' && result.mockDataUpdate.rows) {
          currentMockData.rows = result.mockDataUpdate.rows;
          updates.mockData = currentMockData;
        }
      }

      // Debug: log final updates
      console.log('📝 Interface node updates to apply:', JSON.stringify(updates, null, 2));
      console.log('📋 Changes:', changes);

      return {
        response: result.response,
        updates,
        changes,
      };
    } catch (error) {
      console.error('Interface Node LLM chat error:', error);
      return {
        response: `I encountered an error processing your request. You can ask me to:
• Change the layout (e.g., "switch to post-list layout")
• Add columns (e.g., "add a price column")
• Modify sample data (e.g., "add more sample rows")
• Update the data structure`,
        updates: {},
        changes: [],
      };
    }
  }

  /**
   * Process a chat message to regenerate mock data
   * Uses LLM to generate new mock data based on user instructions
   */
  async processMockDataChat(
    message: string,
    layoutTemplate: LayoutTemplate
  ): Promise<ProcessMockDataChatResult> {
    try {
      // Define schema for table mock data
      const tableMockDataSchema = z.object({
        type: z.literal('table'),
        columns: z.array(z.object({
          key: z.string(),
          header: z.string(),
          type: z.enum(['text', 'number', 'date', 'badge', 'action']),
        })),
        rows: z.array(z.record(z.unknown())),
      });

      // Define schema for post-list mock data
      const postListMockDataSchema = z.object({
        type: z.literal('post-list'),
        posts: z.array(z.object({
          id: z.string(),
          title: z.string(),
          excerpt: z.string(),
          author: z.string(),
          date: z.string(),
          category: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })),
      });

      // Choose schema based on layout
      const mockDataSchema = layoutTemplate === 'table' ? tableMockDataSchema : postListMockDataSchema;

      // Create structured output LLM
      const structuredLLM = this.llm.withStructuredOutput(mockDataSchema);

      const systemPrompt = layoutTemplate === 'table'
        ? `You are generating mock data for a table display. The user will describe what data they want.

IMPORTANT: You MUST return a JSON object with exactly this structure:
- "type": MUST be exactly "table" (this is required, do not use any other value)
- "columns": array of column definitions with key, header, and type (text/number/date/badge/action)
- "rows": array of data rows (3-5 rows) where each row has values for each column key

Generate realistic sample data based on the user's request.
Make sure to follow the user's specific requirements about the data values.`
        : `You are generating mock data for a blog/post list display. The user will describe what posts they want.

IMPORTANT: You MUST return a JSON object with exactly this structure:
- "type": MUST be exactly "post-list" (this is required, do not use any other value)
- "posts": array of post objects with id, title, excerpt, author, date, and optionally category and tags

Generate realistic sample posts based on the user's request.
Make sure to follow the user's specific requirements about the content.`;

      const result = await structuredLLM.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]);

      console.log('🤖 LLM-generated mock data:', JSON.stringify(result, null, 2));

      return {
        response: `I've regenerated the mock data based on your request: "${message}"`,
        mockData: result as MockData,
      };
    } catch (error) {
      console.error('Mock data generation error:', error);
      throw new Error(
        `Failed to generate mock data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
