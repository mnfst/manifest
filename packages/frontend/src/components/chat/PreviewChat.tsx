import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, AlertCircle, Loader2, Wrench, ChevronDown, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../lib/api';
import { useApiKey } from '../../hooks/useApiKey';
import type { ChatMessage, ModelOption, ToolCall, ToolResult } from '@chatgpt-app-builder/shared';

interface PreviewChatProps {
  flowId: string;
  /** Externally managed messages state (persists across tab switches) */
  messages: ChatMessage[];
  /** Callback to update messages */
  onMessagesChange: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
}

/**
 * Preview chat component for testing flows with LLM
 * Displays a chat interface with model selection and tool calling support
 * Messages are managed externally to persist across tab switches
 */
export function PreviewChat({ flowId, messages, onMessagesChange }: PreviewChatProps) {
  const { apiKey, hasApiKey } = useApiKey();
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [error, setError] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Alias for easier migration - use onMessagesChange instead of setMessages
  const setMessages = onMessagesChange;

  // Load available models on mount
  useEffect(() => {
    api.getModels().then((response) => {
      setModels(response.models);
      if (response.models.length > 0) {
        setSelectedModel(response.models[0].id);
      }
    }).catch(() => {
      // Use default models if API fails
      setModels([
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      ]);
    });
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !apiKey) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setIsStreaming(true);

    // Create assistant message placeholder for streaming
    const assistantMessageId = `assistant_${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Build messages array for API
      const apiMessages = messages.concat(userMessage).map((msg) => ({
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolResult: msg.toolResult,
      }));

      // Stream the response
      const stream = api.streamChat(
        { flowId, model: selectedModel, messages: apiMessages },
        apiKey,
      );

      let accumulatedContent = '';
      const toolCalls: ToolCall[] = [];
      const toolResults: ToolResult[] = [];

      for await (const event of stream) {
        switch (event.type) {
          case 'token':
            accumulatedContent += event.content;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
            break;

          case 'tool_call':
            toolCalls.push(event.toolCall);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, toolCalls: [...toolCalls] }
                  : msg
              )
            );
            break;

          case 'tool_result': {
            toolResults.push(event.toolResult);
            // Add tool result as a separate message
            const toolMessage: ChatMessage = {
              id: `tool_${event.toolResult.toolCallId}`,
              role: 'tool',
              content: event.toolResult.content,
              timestamp: new Date(),
              toolResult: event.toolResult,
            };
            setMessages((prev) => [...prev, toolMessage]);
            break;
          }

          case 'error':
            setError(event.error);
            break;

          case 'end':
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the streaming assistant message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
    } finally {
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, apiKey, messages, flowId, selectedModel]);

  // Handle key press (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clear chat history
  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  // If no API key, show disabled state
  if (!hasApiKey) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">API Key Required</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          To use the chat preview, please configure your OpenAI API key in Settings &gt; API Keys.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with model selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Model:</span>
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-background border rounded-md hover:bg-muted transition-colors"
            >
              {models.find((m) => m.id === selectedModel)?.name || selectedModel}
              <ChevronDown className="w-4 h-4" />
            </button>
            {isModelDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-card border rounded-md shadow-lg z-10">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted text-left"
                  >
                    <span>{model.name}</span>
                    {selectedModel === model.id && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleClear}
          disabled={messages.length === 0 || isStreaming}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">Send a message to start chatting with the LLM.</p>
            <p className="text-xs mt-2">The LLM has access to this flow's tools.</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-card p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 border rounded-lg bg-background resize-none text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual message bubble component
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool && message.toolResult) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-4 py-3 rounded-lg bg-muted border text-sm">
          <div className="flex items-center gap-2 text-xs font-medium mb-2">
            <Wrench className="w-4 h-4" />
            <span className="text-foreground">Tool Result: {message.toolResult.name}</span>
            {message.toolResult.success ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Success</span>
            ) : (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Failed</span>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Response:</div>
              <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded border overflow-x-auto max-h-64 overflow-y-auto">
                {message.toolResult.content || message.toolResult.error || 'No output'}
              </pre>
            </div>
            {message.toolResult.structuredContent && Object.keys(message.toolResult.structuredContent).length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Structured Content:</div>
                <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(message.toolResult.structuredContent, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {/* Tool calls display */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 space-y-2">
            {message.toolCalls.map((tc) => (
              <div key={tc.id} className="bg-black/5 dark:bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-2 text-xs font-medium mb-1">
                  <Wrench className="w-3 h-3" />
                  <span>Calling: {tc.name}</span>
                </div>
                {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                  <div className="mt-1">
                    <div className="text-xs text-muted-foreground mb-1">Parameters:</div>
                    <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
                      {JSON.stringify(tc.arguments, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message content with markdown rendering for assistant messages */}
        <div className={isUser ? 'whitespace-pre-wrap' : 'markdown-content'}>
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              components={{
                // Style code blocks
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match && !className;
                  return isInline ? (
                    <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={`block bg-black/10 dark:bg-white/10 p-3 rounded-lg text-sm font-mono overflow-x-auto ${className || ''}`} {...props}>
                      {children}
                    </code>
                  );
                },
                // Style pre blocks
                pre: ({ children }) => (
                  <pre className="my-2 overflow-x-auto">{children}</pre>
                ),
                // Style paragraphs
                p: ({ children }) => (
                  <p className="my-1">{children}</p>
                ),
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
                ),
                // Style links
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    {children}
                  </a>
                ),
                // Style headings
                h1: ({ children }) => <h1 className="text-lg font-bold my-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold my-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold my-1">{children}</h3>,
                // Style blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-gray-400 pl-3 my-2 italic">{children}</blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

export default PreviewChat;
