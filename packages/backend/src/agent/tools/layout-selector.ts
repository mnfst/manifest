import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { LayoutTemplate } from '@chatgpt-app-builder/shared';
import { LAYOUT_REGISTRY } from '@chatgpt-app-builder/shared';

/**
 * Schema for layout selection input
 */
const layoutSelectorSchema = z.object({
  prompt: z.string().describe('The user prompt describing their desired app'),
});

/**
 * Output type for layout selection
 */
export interface LayoutSelectorOutput {
  layout: 'table' | 'post-list';
  reason: string;
}

/**
 * Tool for selecting the most appropriate layout template based on user prompt
 * POC: Chooses between 'table' and 'post-list' layouts
 */
export const layoutSelectorTool = new DynamicStructuredTool({
  name: 'select_layout',
  description: `Select the most appropriate layout template for a ChatGPT app based on the user's description.
Available layouts:
- table: Best for tabular data, lists, order history, product catalogs, structured data
- post-list: Best for content feeds, articles, blog posts, news, updates, announcements`,
  schema: layoutSelectorSchema,
  func: async ({ prompt }): Promise<string> => {
    // This tool will be called by the LLM to make a decision
    // The actual selection logic happens via the LLM's reasoning
    // We return a formatted response that the LLM can parse

    const promptLower = prompt.toLowerCase();

    // Simple heuristic for POC - LLM will make more nuanced decisions
    let selectedLayout: LayoutTemplate = 'table';
    let reason = '';

    // Keywords suggesting post-list layout
    const postKeywords = ['blog', 'article', 'post', 'news', 'feed', 'content', 'story', 'update', 'announcement'];
    const tableKeywords = ['table', 'order', 'list', 'inventory', 'catalog', 'product', 'track', 'data', 'record', 'history'];

    const hasPostKeywords = postKeywords.some(k => promptLower.includes(k));
    const hasTableKeywords = tableKeywords.some(k => promptLower.includes(k));

    if (hasPostKeywords && !hasTableKeywords) {
      selectedLayout = 'post-list';
      reason = 'The prompt mentions content or article-related features';
    } else if (hasTableKeywords) {
      selectedLayout = 'table';
      reason = 'The prompt mentions structured data or list-related features';
    } else {
      selectedLayout = 'table';
      reason = 'Default layout for general-purpose applications';
    }

    const result: LayoutSelectorOutput = {
      layout: selectedLayout,
      reason,
    };

    return JSON.stringify(result);
  },
});

/**
 * Get layout registry information
 */
export function getLayoutInfo(layout: LayoutTemplate) {
  return LAYOUT_REGISTRY[layout];
}
