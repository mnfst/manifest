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
  layout: 'stat-card';
  reason: string;
}

/**
 * Tool for selecting the most appropriate layout template based on user prompt
 * Currently only supports stat-card layout for KPIs and metrics display
 */
export const layoutSelectorTool = new DynamicStructuredTool({
  name: 'select_layout',
  description: `Select the most appropriate layout template for a ChatGPT app based on the user's description.
Available layouts:
- stat-card: Best for KPIs, dashboard stats, metrics overview, performance indicators`,
  schema: layoutSelectorSchema,
  func: async ({ prompt: _prompt }): Promise<string> => {
    // Currently only stat-card layout is available
    // This tool is kept for future expansion when more layouts are added
    const selectedLayout: LayoutTemplate = 'stat-card';
    const reason = 'Stat card layout selected for displaying metrics and KPIs';

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
