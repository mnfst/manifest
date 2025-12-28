import type { ReactNode } from 'react';
import type { PlatformStyle, ThemeMode } from '@chatgpt-app-builder/shared';
import { AppAvatar } from './AppAvatar';
import { chatgptClasses } from './styles/chatgpt';
import { claudeClasses } from './styles/claude';

interface ChatStyleWrapperProps {
  platformStyle: PlatformStyle;
  themeMode: ThemeMode;
  app: {
    name: string;
    logoUrl?: string | null;
  };
  children: ReactNode;
}

/**
 * Get the appropriate style classes for the current platform and theme
 */
function getStyleClasses(platformStyle: PlatformStyle, themeMode: ThemeMode) {
  const styleMap = platformStyle === 'chatgpt' ? chatgptClasses : claudeClasses;
  return styleMap[themeMode];
}

/**
 * ChatStyleWrapper - wraps content in a chat platform-styled container
 * Displays app identity header, content area, and fake input bar
 */
export function ChatStyleWrapper({
  platformStyle,
  themeMode,
  app,
  children,
}: ChatStyleWrapperProps) {
  const classes = getStyleClasses(platformStyle, themeMode);
  const platformName = platformStyle === 'chatgpt' ? 'ChatGPT' : 'Claude';

  return (
    <div className={`h-full flex flex-col ${classes.container}`}>
      {/* App identity header */}
      <div className={`px-4 py-3 flex items-center gap-3 ${classes.header}`}>
        <AppAvatar
          name={app.name}
          logoUrl={app.logoUrl}
          size="md"
        />
        <span className={`font-medium ${classes.text}`}>
          {app.name || 'App'}
        </span>
      </div>

      {/* Message/content area - no card wrapper, remove borders from children */}
      <div className={`flex-1 overflow-auto p-4 ${classes.messageContainer} [&_*]:border-0`}>
        {children}
      </div>

      {/* Fake input bar */}
      <div className={`px-4 py-3 border-t ${classes.header}`}>
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${classes.inputBg} ${classes.inputBorder}`}
        >
          <span className={`flex-1 ${classes.secondaryText}`}>
            Message {platformName}...
          </span>
          <svg
            className={`w-5 h-5 ${classes.secondaryText}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
