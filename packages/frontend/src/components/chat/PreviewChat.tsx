import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Send, Trash2, AlertCircle, Loader2, Wrench, ChevronDown, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../lib/api';
import { useApiKey } from '../../hooks/useApiKey';
import type { ChatMessage, ModelOption, ToolCall, ToolResult, ThemeVariables } from '@chatgpt-app-builder/shared';
import { ThemeProvider } from '../editor/ThemeProvider';
import { Stats } from '../ui/stats';
import { BACKEND_URL } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';

interface PreviewChatProps {
  flowId: string;
  /** Externally managed messages state (persists across tab switches) */
  messages: ChatMessage[];
  /** Callback to update messages */
  onMessagesChange: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  /** App theme variables for styling visual output */
  themeVariables?: ThemeVariables;
}

/**
 * Preview chat component for testing flows with LLM
 * Displays a chat interface with model selection and tool calling support
 * Messages are managed externally to persist across tab switches
 */
export function PreviewChat({ flowId, messages, onMessagesChange, themeVariables }: PreviewChatProps) {
  const { apiKey, hasApiKey } = useApiKey();
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [error, setError] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


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

    onMessagesChange((prev) => [...prev, userMessage]);
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
    onMessagesChange((prev) => [...prev, assistantMessage]);

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
            onMessagesChange((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
            break;

          case 'tool_call':
            toolCalls.push(event.toolCall);
            onMessagesChange((prev) =>
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
            onMessagesChange((prev) => [...prev, toolMessage]);
            break;
          }

          case 'error':
            setError(event.error);
            break;

          case 'end':
            onMessagesChange((prev) =>
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
      onMessagesChange((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
    } finally {
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, apiKey, messages, flowId, selectedModel, onMessagesChange]);

  // Handle key press (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clear chat history
  const handleClear = () => {
    onMessagesChange([]);
    setError(null);
  };

  // If no API key, show disabled state with link to settings
  if (!hasApiKey) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">API Key Required</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          To use the chat preview, please configure your OpenAI API key in{' '}
          <Link
            to="/settings"
            className="text-primary hover:underline font-medium"
          >
            Settings
          </Link>.
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2"
            >
              {models.find((m) => m.id === selectedModel)?.name || selectedModel}
              <ChevronDown className="w-4 h-4" />
            </Button>
            {isModelDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-card border rounded-md shadow-lg z-10">
                {models.map((model) => (
                  <Button
                    key={model.id}
                    variant="ghost"
                    onClick={() => {
                      setSelectedModel(model.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-none h-auto"
                  >
                    <span>{model.name}</span>
                    {selectedModel === model.id && <Check className="w-4 h-4 text-primary" />}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={messages.length === 0 || isStreaming}
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
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
          <MessageBubble key={message.id} message={message} themeVariables={themeVariables} />
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
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="px-4 py-2"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual message bubble component
 */
function MessageBubble({ message, themeVariables }: { message: ChatMessage; themeVariables?: ThemeVariables }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool && message.toolResult) {
    // Check if we have structured content with stats to render visually
    const hasVisualContent = Boolean(message.toolResult.structuredContent?.stats);

    // Check if we have a custom widget template (RegistryComponent)
    const meta = message.toolResult._meta as Record<string, unknown> | undefined;
    const outputTemplate = meta?.['openai/outputTemplate'] as string | undefined;
    const hasWidgetTemplate = Boolean(outputTemplate && outputTemplate.startsWith('ui://widget/'));

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
            {/* Custom widget output via iframe */}
            {hasWidgetTemplate && outputTemplate && (
              <WidgetIframe
                outputTemplate={outputTemplate}
                structuredContent={message.toolResult.structuredContent}
              />
            )}
            {/* Visual output for stat cards */}
            {hasVisualContent && themeVariables && !hasWidgetTemplate && (
              <div className="rounded-lg overflow-hidden border">
                <ThemeProvider themeVariables={themeVariables}>
                  <Stats data={message.toolResult.structuredContent} />
                </ThemeProvider>
              </div>
            )}
            {/* Text response */}
            {message.toolResult.content && !hasWidgetTemplate && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Response:</div>
                <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded border overflow-x-auto max-h-64 overflow-y-auto">
                  {message.toolResult.content}
                </pre>
              </div>
            )}
            {/* Error message */}
            {message.toolResult.error && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Error:</div>
                <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded border overflow-x-auto max-h-64 overflow-y-auto text-red-600">
                  {message.toolResult.error}
                </pre>
              </div>
            )}
            {/* Structured content as JSON (only if no visual rendering or no theme) */}
            {message.toolResult.structuredContent && Object.keys(message.toolResult.structuredContent).length > 0 && (!hasVisualContent || !themeVariables) && !hasWidgetTemplate && (
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

/**
 * Widget iframe component for rendering custom widget HTML
 * Fetches the widget HTML from the MCP server and renders it in an iframe
 */
function WidgetIframe({
  outputTemplate,
  structuredContent,
}: {
  outputTemplate: string;
  structuredContent?: Record<string, unknown>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse the outputTemplate URI to get the MCP resource path
  // Format: ui://widget/{appSlug}/{toolName}/{nodeId}.html
  useEffect(() => {
    const match = outputTemplate.match(/^ui:\/\/widget\/([^/]+)\/(.+)$/);
    if (!match) {
      setError('Invalid widget template URI');
      setLoading(false);
      return;
    }

    const appSlug = match[1];
    // resourcePath is match[2] but we use the full outputTemplate URI for the request

    // Fetch the widget HTML via MCP resources/read
    const fetchWidget = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/servers/${appSlug}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'resources/read',
            params: { uri: outputTemplate },
          }),
        });

        const result = await response.json();

        if (result.error) {
          setError(result.error.message || 'Failed to fetch widget');
          setLoading(false);
          return;
        }

        const contents = result.result?.contents;
        if (contents && contents.length > 0 && contents[0].text) {
          setWidgetHtml(contents[0].text);
        } else {
          setError('Widget HTML not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch widget');
      } finally {
        setLoading(false);
      }
    };

    fetchWidget();
  }, [outputTemplate]);

  // Send data to iframe when it loads
  useEffect(() => {
    if (widgetHtml && iframeRef.current && structuredContent) {
      const sendData = () => {
        iframeRef.current?.contentWindow?.postMessage(
          { structuredContent },
          '*'
        );
      };

      // Send immediately and after a short delay (for slow-loading iframes)
      sendData();
      const timer = setTimeout(sendData, 500);
      return () => clearTimeout(timer);
    }
  }, [widgetHtml, structuredContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-background rounded-lg border">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        {error}
      </div>
    );
  }

  if (!widgetHtml) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden border bg-white">
      <iframe
        ref={iframeRef}
        srcDoc={widgetHtml}
        className="w-full border-0"
        style={{ minHeight: '200px', height: 'auto' }}
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => {
          // Send data to iframe after it loads
          if (iframeRef.current && structuredContent) {
            iframeRef.current.contentWindow?.postMessage(
              { structuredContent },
              '*'
            );
          }
        }}
      />
    </div>
  );
}

export default PreviewChat;
