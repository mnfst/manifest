import { useState, useEffect } from 'react';
import type { Flow, App, MockData } from '@chatgpt-app-builder/shared';
import { DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA } from '@chatgpt-app-builder/shared';
import { useTypingAnimation } from '../../hooks/useTypingAnimation';
import { usePreviewPreferences } from '../../hooks/usePreviewPreferences';
import { ChatConversation } from './ChatConversation';
import { ChatMessage } from './ChatMessage';
import { LayoutRenderer } from '../editor/LayoutRenderer';
import { ThemeProvider } from '../editor/ThemeProvider';

/**
 * Animation phases for the preview sequence
 */
type PreviewAnimationPhase =
  | 'typing'      // User message being typed
  | 'thinking'    // Pause simulating LLM processing
  | 'response'    // LLM response appearing
  | 'complete';   // All animations done

interface FlowPreviewProps {
  /** Flow data including name and views */
  flow: Flow;
  /** App data for theming */
  app: App;
}

/**
 * FlowPreview - Orchestrates the preview experience
 * Displays a simulated ChatGPT conversation with animated typing
 * and renders the flow's component view in the LLM response
 */
export function FlowPreview({ flow, app }: FlowPreviewProps) {
  const [phase, setPhase] = useState<PreviewAnimationPhase>('typing');
  const { themeMode, toggleThemeMode } = usePreviewPreferences();
  const isDarkMode = themeMode === 'dark';

  // Use flow name as the user message (truncate if too long)
  const MAX_MESSAGE_LENGTH = 200;
  const userMessage = flow.name.length > MAX_MESSAGE_LENGTH
    ? flow.name.slice(0, MAX_MESSAGE_LENGTH) + '...'
    : flow.name;

  // Typing animation for user message
  // Speed calculated to complete within ~2s for typical flow names (20-50 chars)
  // 40ms base speed with ±15ms variation = 25-55ms per char
  // For 50 chars: ~1.25-2.75s, average ~2s
  const { displayedText, isComplete: typingComplete } = useTypingAnimation({
    text: userMessage,
    speed: 40,
    randomVariation: 15,
    autoStart: true,
  });

  // Handle phase transitions
  useEffect(() => {
    if (!typingComplete || phase !== 'typing') return;

    // Transition to thinking phase after typing completes
    setPhase('thinking');
  }, [typingComplete, phase]);

  // Separate effect for thinking -> response transition
  useEffect(() => {
    if (phase !== 'thinking') return;

    const thinkingTimeout = setTimeout(() => {
      setPhase('response');
    }, 750); // 750ms thinking pause

    return () => clearTimeout(thinkingTimeout);
  }, [phase]);

  // Separate effect for response -> complete transition
  useEffect(() => {
    if (phase !== 'response') return;

    const completeTimeout = setTimeout(() => {
      setPhase('complete');
    }, 300);

    return () => clearTimeout(completeTimeout);
  }, [phase]);

  // Get first view from flow (only display first view in preview)
  const firstView = flow.views?.[0];

  // Get mock data for the view (or use defaults)
  const getMockData = (view: typeof firstView): MockData => {
    if (!view) return DEFAULT_TABLE_MOCK_DATA;
    return view.mockData?.data || (view.layoutTemplate === 'post-list'
      ? DEFAULT_POST_LIST_MOCK_DATA
      : DEFAULT_TABLE_MOCK_DATA);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar with dark mode toggle */}
      <div className={`px-4 py-2 flex items-center justify-end border-b ${isDarkMode ? 'bg-[#2f2f2f] border-[#3f3f3f]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Dark</span>
          <button
            onClick={toggleThemeMode}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                isDarkMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Chat conversation */}
      <div className="flex-1 overflow-hidden">
        <ChatConversation isDarkMode={isDarkMode}>
          {/* User message with typing animation */}
          <ChatMessage
            role="user"
            content={displayedText}
            showCursor={phase === 'typing'}
            isDarkMode={isDarkMode}
          />

          {/* Thinking indicator */}
          {phase === 'thinking' && (
            <ChatMessage
              role="assistant"
              isDarkMode={isDarkMode}
              content={
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-[#8e8ea0]' : 'bg-gray-400'}`} style={{ animationDelay: '0ms' }} />
                  <span className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-[#8e8ea0]' : 'bg-gray-400'}`} style={{ animationDelay: '150ms' }} />
                  <span className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-[#8e8ea0]' : 'bg-gray-400'}`} style={{ animationDelay: '300ms' }} />
                </div>
              }
            />
          )}

          {/* LLM response with first view's component */}
          {(phase === 'response' || phase === 'complete') && firstView && (
            <ChatMessage
              role="assistant"
              isDarkMode={isDarkMode}
              content={
                <div className="rounded-lg overflow-hidden">
                  <ThemeProvider
                    themeVariables={app.themeVariables || {}}
                    isDarkMode={isDarkMode}
                  >
                    <LayoutRenderer
                      layoutTemplate={firstView.layoutTemplate}
                      mockData={getMockData(firstView)}
                      isDarkMode={isDarkMode}
                    />
                  </ThemeProvider>
                </div>
              }
            />
          )}
        </ChatConversation>
      </div>
    </div>
  );
}
