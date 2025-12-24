/**
 * Theme variables for shadcn CSS customization
 * Based on shadcn/ui CSS variable naming convention
 */
export interface ThemeVariables {
  '--primary': string;
  '--primary-foreground': string;
  '--background': string;
  '--foreground': string;
  '--muted': string;
  '--muted-foreground': string;
  '--accent': string;
  '--accent-foreground': string;
  '--card'?: string;
  '--card-foreground'?: string;
  '--popover'?: string;
  '--popover-foreground'?: string;
  '--secondary'?: string;
  '--secondary-foreground'?: string;
  '--border'?: string;
  '--input'?: string;
  '--ring'?: string;
  '--radius'?: string;
  '--destructive'?: string;
  '--destructive-foreground'?: string;
  // Allow additional CSS variables
  [key: `--${string}`]: string | undefined;
}

/**
 * Default theme variables (neutral shadcn theme)
 */
export const DEFAULT_THEME_VARIABLES: ThemeVariables = {
  '--primary': '222.2 47.4% 11.2%',
  '--primary-foreground': '210 40% 98%',
  '--background': '0 0% 100%',
  '--foreground': '222.2 47.4% 11.2%',
  '--muted': '210 40% 96.1%',
  '--muted-foreground': '215.4 16.3% 46.9%',
  '--accent': '210 40% 96.1%',
  '--accent-foreground': '222.2 47.4% 11.2%',
  '--card': '0 0% 100%',
  '--card-foreground': '222.2 47.4% 11.2%',
  '--border': '214.3 31.8% 91.4%',
  '--input': '214.3 31.8% 91.4%',
  '--ring': '222.2 47.4% 11.2%',
  '--radius': '0.5rem',
};
