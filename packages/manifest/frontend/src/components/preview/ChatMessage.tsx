import type { ReactNode } from 'react';
import { User, Sparkles } from 'lucide-react';

type ChatMessageRole = 'user' | 'assistant';

interface ChatMessageProps {
  role: ChatMessageRole;
  content: ReactNode;
  /** Show typing animation cursor */
  showCursor?: boolean;
  /** Dark mode styling */
  isDarkMode?: boolean;
}

/**
 * Individual chat message component with theme support
 * Displays avatar, message bubble with appropriate styling based on role
 */
export function ChatMessage({ role, content, showCursor = false, isDarkMode = false }: ChatMessageProps) {
  const isUser = role === 'user';

  // Theme-aware colors
  const userBubbleBg = isDarkMode ? 'bg-[#3e3f4a]' : 'bg-blue-100';
  const userBubbleText = isDarkMode ? 'text-[#ececf1]' : 'text-gray-900';
  const assistantBubbleText = isDarkMode ? 'text-[#ececf1]' : 'text-gray-900';
  const cursorBg = isDarkMode ? 'bg-[#ececf1]' : 'bg-gray-900';

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center shrink-0
          ${isUser ? 'bg-[#5436DA]' : 'bg-[#10a37f]'}
        `}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Sparkles className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${isUser
            ? `${userBubbleBg} ${userBubbleText}`
            : `bg-transparent ${assistantBubbleText}`
          }
        `}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {content}
          {showCursor && (
            <span className={`inline-block w-0.5 h-4 ${cursorBg} ml-0.5 animate-pulse`} />
          )}
        </div>
      </div>
    </div>
  );
}
