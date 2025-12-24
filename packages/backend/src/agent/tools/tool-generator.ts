import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Schema for tool generation input
 */
const toolGeneratorSchema = z.object({
  prompt: z.string().describe('The user prompt describing their desired app'),
  layoutTemplate: z.enum(['table', 'post-list']).describe('The selected layout template'),
});

/**
 * Output type for tool generation
 */
export interface ToolGeneratorOutput {
  toolName: string;
  toolDescription: string;
  appName: string;
  appDescription: string;
}

/**
 * Tool for generating MCP tool name and description based on user prompt
 * Creates LLM-friendly metadata that helps AI assistants understand when to use the tool
 */
export const toolGeneratorTool = new DynamicStructuredTool({
  name: 'generate_tool_config',
  description: `Generate an MCP tool name and description for a ChatGPT app.
The tool name should be in snake_case and describe the action (e.g., search_products, get_order_status).
The description should explain what the tool does, when to use it, and what information it needs.`,
  schema: toolGeneratorSchema,
  func: async ({ prompt, layoutTemplate }): Promise<string> => {
    const promptLower = prompt.toLowerCase();

    // Extract key concepts from the prompt
    let domain = 'app';
    let action = 'query';

    // Domain detection
    const domains = [
      { keywords: ['product', 'shop', 'store', 'catalog', 'e-commerce', 'inventory'], domain: 'product' },
      { keywords: ['order', 'purchase', 'buy', 'transaction', 'checkout'], domain: 'order' },
      { keywords: ['customer', 'support', 'help', 'service', 'ticket'], domain: 'support' },
      { keywords: ['blog', 'article', 'post', 'content', 'news'], domain: 'content' },
      { keywords: ['user', 'profile', 'account', 'member'], domain: 'user' },
      { keywords: ['track', 'ship', 'delivery', 'logistics'], domain: 'shipment' },
    ];

    for (const d of domains) {
      if (d.keywords.some(k => promptLower.includes(k))) {
        domain = d.domain;
        break;
      }
    }

    // Action detection
    const actions = [
      { keywords: ['search', 'find', 'look'], action: 'search' },
      { keywords: ['list', 'show', 'display', 'get'], action: 'get' },
      { keywords: ['track', 'status', 'check'], action: 'track' },
      { keywords: ['create', 'add', 'new'], action: 'create' },
    ];

    for (const a of actions) {
      if (a.keywords.some(k => promptLower.includes(k))) {
        action = a.action;
        break;
      }
    }

    // Generate tool name
    const toolName = `${action}_${domain}s`;

    // Generate app name (title case)
    const appName = prompt
      .split(' ')
      .slice(0, 5)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim() || 'My ChatGPT App';

    // Generate descriptions based on layout and domain
    const layoutContext = layoutTemplate === 'table'
      ? 'Returns structured data in a table format'
      : 'Returns content in a list/feed format';

    const toolDescription = `${capitalize(action)} ${domain}s based on user queries. ${layoutContext}. ` +
      `Use this tool when the user asks about ${domain}-related information. ` +
      `Provide relevant search terms or identifiers for best results.`;

    const appDescription = `A ChatGPT app that helps users ${action} and explore ${domain} information.`;

    const result: ToolGeneratorOutput = {
      toolName,
      toolDescription,
      appName,
      appDescription,
    };

    return JSON.stringify(result);
  },
});

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
