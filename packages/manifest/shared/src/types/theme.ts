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

