import { Injectable } from '@nestjs/common';
import type { App, LayoutTemplate, ThemeVariables, MockData } from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import { createLLM, getCurrentProvider } from './llm';
import {
  layoutSelectorTool,
  toolGeneratorTool,
  themeGeneratorTool,
  mockDataGeneratorTool,
  configUpdaterTool,
} from './tools';
import type { ConfigUpdaterOutput } from './tools';

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
   * Interprets the message and returns updates to apply
   */
  async processChat(message: string, currentApp: App): Promise<ProcessChatResult> {
    // Convert ThemeVariables to Record<string, string> for the tool
    const themeRecord: Record<string, string> = {};
    for (const [key, value] of Object.entries(currentApp.themeVariables)) {
      if (value !== undefined) {
        themeRecord[key] = value;
      }
    }

    // Use config updater tool to interpret the message
    const result = await configUpdaterTool.invoke({
      message,
      currentConfig: {
        layoutTemplate: currentApp.layoutTemplate,
        themeVariables: themeRecord,
        toolName: currentApp.toolName,
        toolDescription: currentApp.toolDescription,
      },
    });

    const parsed: ConfigUpdaterOutput = JSON.parse(result);
    const updates: Partial<App> = { ...parsed.updates };

    // If layout changed, regenerate mock data for new layout
    if (parsed.updates.layoutTemplate && parsed.updates.layoutTemplate !== currentApp.layoutTemplate) {
      const mockResult = await mockDataGeneratorTool.invoke({
        prompt: currentApp.systemPrompt,
        layoutTemplate: parsed.updates.layoutTemplate,
      });
      const mockDataResult = JSON.parse(mockResult);
      updates.mockData = mockDataResult.mockData;
    }

    return {
      response: parsed.response,
      updates,
      changes: parsed.changes,
    };
  }
}
