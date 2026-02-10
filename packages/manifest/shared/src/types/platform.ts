/**
 * Platform style options for chat preview rendering
 */
export type PlatformStyle = 'chatgpt' | 'claude';

/**
 * Theme mode for light/dark appearance
 */
export type ThemeMode = 'light' | 'dark';

/**
 * User preferences for preview rendering
 */
export interface PreviewPreferences {
  platformStyle: PlatformStyle;
  themeMode: ThemeMode;
}

