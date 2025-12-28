import type { ReactNode } from 'react';

interface ChatConversationProps {
  children: ReactNode;
  isDarkMode?: boolean;
}

/**
 * Container component for chat conversation with theme support
 * Provides proper spacing and background for message list
 */
export function ChatConversation({ children, isDarkMode = false }: ChatConversationProps) {
  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
      {/* Messages area with vertical spacing */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
