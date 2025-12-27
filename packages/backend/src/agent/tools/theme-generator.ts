import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ThemeVariables } from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';

/**
 * Schema for theme generation input
 */
const themeGeneratorSchema = z.object({
  prompt: z.string().describe('The user prompt describing their desired app'),
});

/**
 * Predefined color palettes for different contexts
 */
const COLOR_PALETTES: Record<string, Partial<ThemeVariables>> = {
  professional: {
    '--primary': '222.2 47.4% 11.2%',
    '--primary-foreground': '210 40% 98%',
    '--background': '0 0% 100%',
    '--foreground': '222.2 47.4% 11.2%',
    '--accent': '210 40% 96.1%',
    '--accent-foreground': '222.2 47.4% 11.2%',
  },
  ecommerce: {
    '--primary': '142 76% 36%',
    '--primary-foreground': '355 100% 100%',
    '--background': '0 0% 100%',
    '--foreground': '240 10% 3.9%',
    '--accent': '142 76% 94%',
    '--accent-foreground': '142 76% 36%',
  },
  support: {
    '--primary': '221 83% 53%',
    '--primary-foreground': '210 40% 98%',
    '--background': '0 0% 100%',
    '--foreground': '222.2 47.4% 11.2%',
    '--accent': '221 83% 94%',
    '--accent-foreground': '221 83% 53%',
  },
  content: {
    '--primary': '262 83% 58%',
    '--primary-foreground': '210 40% 98%',
    '--background': '0 0% 100%',
    '--foreground': '240 10% 3.9%',
    '--accent': '262 83% 94%',
    '--accent-foreground': '262 83% 58%',
  },
  warm: {
    '--primary': '24 95% 53%',
    '--primary-foreground': '60 9.1% 97.8%',
    '--background': '0 0% 100%',
    '--foreground': '20 14.3% 4.1%',
    '--accent': '24 95% 94%',
    '--accent-foreground': '24 95% 53%',
  },
  cool: {
    '--primary': '199 89% 48%',
    '--primary-foreground': '210 40% 98%',
    '--background': '0 0% 100%',
    '--foreground': '222.2 47.4% 11.2%',
    '--accent': '199 89% 94%',
    '--accent-foreground': '199 89% 48%',
  },
};

/**
 * Tool for generating shadcn theme variables based on user prompt
 * Analyzes the prompt context to select an appropriate color palette
 */
export const themeGeneratorTool = new DynamicStructuredTool({
  name: 'generate_theme',
  description: `Generate shadcn CSS variable overrides to style a ChatGPT app.
Analyzes the prompt to determine an appropriate color scheme based on the app's purpose.
Returns theme variables that can be applied to customize the visual appearance.`,
  schema: themeGeneratorSchema,
  func: async ({ prompt }): Promise<string> => {
    const promptLower = prompt.toLowerCase();

    // Determine the most appropriate palette based on prompt context
    let selectedPalette = 'professional';

    if (promptLower.match(/shop|store|product|catalog|e-commerce|buy|sell|cart/)) {
      selectedPalette = 'ecommerce';
    } else if (promptLower.match(/support|help|ticket|customer|service|assist/)) {
      selectedPalette = 'support';
    } else if (promptLower.match(/blog|article|content|news|story|post|publish/)) {
      selectedPalette = 'content';
    } else if (promptLower.match(/warm|orange|red|cozy|friendly/)) {
      selectedPalette = 'warm';
    } else if (promptLower.match(/cool|blue|calm|professional|corporate/)) {
      selectedPalette = 'cool';
    }

    // Merge selected palette with defaults
    const themeVariables: ThemeVariables = {
      ...DEFAULT_THEME_VARIABLES,
      ...COLOR_PALETTES[selectedPalette],
    };

    return JSON.stringify({
      palette: selectedPalette,
      themeVariables,
    });
  },
});
