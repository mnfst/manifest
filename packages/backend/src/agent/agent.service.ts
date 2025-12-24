import { Injectable } from '@nestjs/common';
import type { App, LayoutTemplate, ThemeVariables, MockData } from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
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
 * Result of chat processing
 */
export interface ProcessChatResult {
  response: string;
  updates: Partial<App>;
  changes: string[];
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
}
