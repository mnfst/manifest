import type { ThemeVariables } from '../types/theme.js';

/**
 * Groups related theme variables for UI organization
 */
export interface ThemeVariableGroup {
  /** Display name for the group */
  label: string;
  /** Variable keys in this group */
  variables: (keyof ThemeVariables)[];
  /** Optional description for the group */
  description?: string;
}

/**
 * Theme variable groups organized for shadcn theme editing
 */
export const THEME_VARIABLE_GROUPS: ThemeVariableGroup[] = [
  {
    label: 'Primary',
    variables: ['--primary', '--primary-foreground'],
    description: 'Main brand colors for buttons and links',
  },
  {
    label: 'Background',
    variables: ['--background', '--foreground'],
    description: 'Page background and default text',
  },
  {
    label: 'Muted',
    variables: ['--muted', '--muted-foreground'],
    description: 'Subdued backgrounds and secondary text',
  },
  {
    label: 'Accent',
    variables: ['--accent', '--accent-foreground'],
    description: 'Highlights and focus states',
  },
  {
    label: 'Card',
    variables: ['--card', '--card-foreground'],
    description: 'Card component colors',
  },
  {
    label: 'Popover',
    variables: ['--popover', '--popover-foreground'],
    description: 'Dropdown and popover colors',
  },
  {
    label: 'Secondary',
    variables: ['--secondary', '--secondary-foreground'],
    description: 'Secondary action colors',
  },
  {
    label: 'Destructive',
    variables: ['--destructive', '--destructive-foreground'],
    description: 'Error and danger states',
  },
  {
    label: 'Borders & Inputs',
    variables: ['--border', '--input', '--ring'],
    description: 'Form elements and dividers',
  },
  {
    label: 'Spacing',
    variables: ['--radius'],
    description: 'Border radius for rounded corners',
  },
];
