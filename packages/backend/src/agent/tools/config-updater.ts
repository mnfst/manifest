import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { LayoutTemplate, ThemeVariables, MockData } from '@chatgpt-app-builder/shared';

/**
 * Schema for config update input
 */
const configUpdaterSchema = z.object({
  message: z.string().describe('The user message requesting changes'),
  currentConfig: z.object({
    layoutTemplate: z.enum(['table', 'post-list']),
    themeVariables: z.record(z.string()),
    toolName: z.string().optional(),
    toolDescription: z.string().optional(),
  }).describe('Current app configuration'),
});

/**
 * Output updates type
 */
interface ConfigUpdates {
  layoutTemplate?: LayoutTemplate;
  themeVariables?: ThemeVariables;
  toolName?: string;
  toolDescription?: string;
  mockData?: MockData;
}

/**
 * Exported output type (includes mockData for layout changes)
 */
export interface ConfigUpdaterOutput {
  updates: ConfigUpdates;
  changes: string[];
  response: string;
  understood: boolean;
}

/**
 * Color name to HSL mapping
 */
const COLOR_MAP: Record<string, string> = {
  blue: '221 83% 53%',
  red: '0 84% 60%',
  green: '142 76% 36%',
  purple: '262 83% 58%',
  orange: '24 95% 53%',
  yellow: '47 96% 53%',
  pink: '330 81% 60%',
  teal: '172 66% 50%',
  indigo: '239 84% 67%',
  gray: '220 9% 46%',
  black: '0 0% 0%',
  white: '0 0% 100%',
  dark: '222.2 47.4% 11.2%',
  light: '210 40% 96.1%',
};

/**
 * Tool for updating app configuration based on user chat messages
 * Interprets natural language requests and generates config updates
 */
export const configUpdaterTool = new DynamicStructuredTool({
  name: 'update_config',
  description: `Update app configuration based on user requests.
Can modify: layout template, theme colors, tool name, tool description.
Analyzes the user's message and determines what configuration changes to apply.`,
  schema: configUpdaterSchema,
  func: async ({ message, currentConfig }): Promise<string> => {
    const messageLower = message.toLowerCase();
    const updates: ConfigUpdates = {};
    const changes: string[] = [];
    let response = '';
    let understood = true;

    // Check for layout change requests
    if (messageLower.includes('table') && currentConfig.layoutTemplate !== 'table') {
      updates.layoutTemplate = 'table';
      changes.push('Changed layout to table');
    } else if (
      (messageLower.includes('post') || messageLower.includes('blog') || messageLower.includes('list')) &&
      messageLower.includes('layout') &&
      currentConfig.layoutTemplate !== 'post-list'
    ) {
      updates.layoutTemplate = 'post-list';
      changes.push('Changed layout to post-list');
    }

    // Check for color change requests
    const colorPattern = /(?:change|set|make|use).*(?:color|primary|theme).*(?:to\s+)?(\w+)/i;
    const colorMatch = message.match(colorPattern);
    if (colorMatch) {
      const colorName = colorMatch[1].toLowerCase();
      if (COLOR_MAP[colorName]) {
        updates.themeVariables = {
          ...currentConfig.themeVariables,
          '--primary': COLOR_MAP[colorName],
          '--primary-foreground': colorName === 'white' || colorName === 'light' || colorName === 'yellow'
            ? '222.2 47.4% 11.2%'
            : '210 40% 98%',
        } as ThemeVariables;
        changes.push(`Updated primary color to ${colorName}`);
      }
    }

    // Check for background color changes
    const bgPattern = /(?:background|bg).*(?:to\s+)?(\w+)/i;
    const bgMatch = message.match(bgPattern);
    if (bgMatch) {
      const colorName = bgMatch[1].toLowerCase();
      if (colorName === 'dark') {
        updates.themeVariables = {
          ...(updates.themeVariables || currentConfig.themeVariables),
          '--background': '222.2 47.4% 11.2%',
          '--foreground': '210 40% 98%',
          '--card': '222.2 47.4% 15%',
          '--card-foreground': '210 40% 98%',
          '--muted': '217.2 32.6% 17.5%',
          '--muted-foreground': '215 20.2% 65.1%',
        } as ThemeVariables;
        changes.push('Applied dark background theme');
      } else if (colorName === 'light' || colorName === 'white') {
        updates.themeVariables = {
          ...(updates.themeVariables || currentConfig.themeVariables),
          '--background': '0 0% 100%',
          '--foreground': '222.2 47.4% 11.2%',
          '--card': '0 0% 100%',
          '--card-foreground': '222.2 47.4% 11.2%',
        } as ThemeVariables;
        changes.push('Applied light background theme');
      }
    }

    // Check for tool name change
    const toolNamePattern = /(?:rename|change|set).*tool.*(?:name|to)\s+['""]?([a-z_]+)['""]?/i;
    const toolNameMatch = message.match(toolNamePattern);
    if (toolNameMatch) {
      updates.toolName = toolNameMatch[1].toLowerCase().replace(/\s+/g, '_');
      changes.push(`Renamed tool to "${updates.toolName}"`);
    }

    // Check for tool description update
    if (messageLower.includes('description') && messageLower.includes('tool')) {
      const descPattern = /description.*['""](.+?)['""]|update.*description.*to\s+(.+)/i;
      const descMatch = message.match(descPattern);
      if (descMatch) {
        updates.toolDescription = descMatch[1] || descMatch[2];
        changes.push('Updated tool description');
      }
    }

    // Generate response
    if (changes.length > 0) {
      response = `I've made the following changes:\n${changes.map(c => `• ${c}`).join('\n')}`;
    } else {
      understood = false;
      response = `I couldn't identify specific changes from your request. You can ask me to:
• Change the layout (e.g., "switch to table layout")
• Update colors (e.g., "change primary color to blue")
• Modify the tool name (e.g., "rename tool to search_products")
• Update the tool description`;
    }

    const result: ConfigUpdaterOutput = {
      updates,
      changes,
      response,
      understood,
    };

    return JSON.stringify(result);
  },
});
