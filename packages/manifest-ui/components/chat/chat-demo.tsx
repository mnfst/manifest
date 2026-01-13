'use client'

import { cn } from '@/lib/utils'
import { Send, Copy, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content?: string
  component?: React.ReactNode
  contentAfter?: string
  hasPadding?: boolean
  brand?: {
    name: string
    logo?: React.ReactNode
  }
}

interface ChatDemoProps {
  messages: Message[]
  className?: string
  variant?: 'chatgpt' | 'claude'
}

function ChatGPTIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero" />
    </svg>
  )
}

export function ChatDemo({ messages, className, variant = 'chatgpt' }: ChatDemoProps) {
  const isChatGPT = variant === 'chatgpt'

  return (
    <div className={cn(
      'flex flex-col h-[600px] rounded-xl overflow-hidden',
      isChatGPT
        ? 'bg-[#212121] text-white'
        : 'bg-[#F1F0E8] text-[#1a1a1a] border border-[#E5E3DB]',
      className
    )}>
      {/* Chat header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 border-b',
        isChatGPT
          ? 'border-[#333] bg-[#212121]'
          : 'border-[#E5E3DB] bg-[#F1F0E8]'
      )}>
        <div className="flex items-center gap-2">
          {isChatGPT ? (
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white">
              <ChatGPTIcon className="h-5 w-5 text-black" />
            </div>
          ) : (
            <ClaudeIcon className="h-6 w-6" />
          )}
          <span className="font-medium">{isChatGPT ? 'ChatGPT' : 'Claude'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className={cn(
        'flex-1 overflow-y-auto p-4',
        isChatGPT ? 'bg-[#212121]' : 'bg-[#F1F0E8]'
      )}>
        <div className={cn(
          'mx-auto space-y-4',
          isChatGPT
            ? 'max-w-[calc(100vw-16px)] sm:max-w-[768px]'
            : 'max-w-[calc(100vw-16px)] sm:max-w-[720px]'
        )}>
          {messages.map((message, index) => {
            return (
              <div
                key={index}
                className={cn(
                  'flex flex-col',
                  message.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'space-y-3',
                    message.role === 'user'
                      ? cn(
                          'max-w-[80%]',
                          isChatGPT
                            ? 'bg-[#2f2f2f] rounded-2xl px-4 py-2'
                            : 'bg-[#F0EDE6] rounded-2xl px-4 py-2'
                        )
                      : 'w-full'
                  )}
                >
                  {message.content && (
                    <p className="text-sm">{message.content}</p>
                  )}
                  {message.component && (
                    <div className="mt-2 w-full">
                      {/* Brand header with reaction icons */}
                      {message.brand && (
                        <div className={cn(
                          'flex items-center justify-between px-1 py-2 text-xs',
                          isChatGPT
                            ? 'text-gray-400'
                            : 'text-gray-500'
                        )}>
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0">{message.brand.logo}</span>
                            <span className="font-medium">{message.brand.name}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button type="button" className={cn(
                              'p-1.5 rounded flex items-center justify-center',
                              isChatGPT ? 'hover:bg-white/10' : 'hover:bg-black/5'
                            )}>
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className={cn(
                              'p-1.5 rounded flex items-center justify-center',
                              isChatGPT ? 'hover:bg-white/10' : 'hover:bg-black/5'
                            )}>
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Iframe-like container */}
                      <div className={cn(
                        'w-full rounded-lg overflow-hidden',
                        isChatGPT
                          ? 'border border-[#444] bg-[#2f2f2f] shadow-lg shadow-black/20'
                          : 'border border-[#D5D3CB] bg-white shadow-md shadow-black/5'
                      )}>
                        <div className={cn(
                          message.hasPadding ? 'p-3' : 'p-0',
                          isChatGPT ? 'dark' : 'light'
                        )}>
                          {message.component}
                        </div>
                      </div>
                    </div>
                  )}
                  {message.contentAfter && (
                    <p className="text-sm mt-3">{message.contentAfter}</p>
                  )}
                </div>
                {/* Reaction icons for text-only assistant messages */}
                {message.role === 'assistant' && !message.component && (
                  <div className={cn(
                    'flex items-center gap-1 mt-2',
                    isChatGPT ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    {!isChatGPT && (
                      <ClaudeIcon className="h-4 w-4 mr-1" />
                    )}
                    <button type="button" className={cn(
                      'p-1.5 rounded',
                      isChatGPT ? 'hover:bg-white/10' : 'hover:bg-black/5'
                    )}>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className={cn(
                      'p-1.5 rounded',
                      isChatGPT ? 'hover:bg-white/10' : 'hover:bg-black/5'
                    )}>
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className={cn(
                      'p-1.5 rounded',
                      isChatGPT ? 'hover:bg-white/10' : 'hover:bg-black/5'
                    )}>
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className={cn(
                      'p-1.5 rounded',
                      isChatGPT ? 'hover:bg-white/10' : 'hover:bg-black/5'
                    )}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Input */}
      <div className={cn(
        'border-t p-4',
        isChatGPT ? 'border-[#333] bg-[#212121]' : 'border-[#E5E3DB] bg-[#F1F0E8]'
      )}>
        <div className={cn(
          'mx-auto',
          isChatGPT
            ? 'max-w-[calc(100vw-16px)] sm:max-w-[768px]'
            : 'max-w-[calc(100vw-16px)] sm:max-w-[720px]'
        )}>
          <div className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-2',
            isChatGPT
              ? 'border-[#444] bg-[#2f2f2f]'
              : 'border-[#D5D3CB] bg-white'
          )}>
            <input
              type="text"
              placeholder={isChatGPT ? 'Message ChatGPT...' : 'Message Claude...'}
              className={cn(
                'flex-1 bg-transparent text-sm outline-none',
                isChatGPT ? 'placeholder:text-[#888]' : 'placeholder:text-[#999]'
              )}
              disabled
            />
            <button className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center opacity-50',
              isChatGPT ? 'bg-white' : 'bg-[#D97757]'
            )}>
              <Send className={cn('h-4 w-4', isChatGPT ? 'text-black' : 'text-white')} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
