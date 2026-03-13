import { useState } from 'react';
import { Bot, User, Info } from 'lucide-react';
import { cn, formatTime, formatTokens } from '../../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { EnrichedConversationTurn } from '../hooks/useAgentConversation';

interface ConversationMessageProps {
  turn: EnrichedConversationTurn;
}

export function ConversationMessage({ turn }: ConversationMessageProps) {
  const isUser = turn.role === "user";
  const [tooltip, setTooltip] = useState<'input' | 'output' | 'hint' | null>(null);
  const isFromWeb = turn.source === 'web';

  return (
    <div
      className={cn(
        'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
      )}

      <div className="flex flex-col max-w-[75%] gap-1">
        {/* Source indicator for web messages */}
        {isFromWeb && (
          <div className="text-xs text-muted-foreground px-2">
            Sent from Web UI
          </div>
        )}

        <div
          className={cn(
            'rounded-lg px-4 py-3 break-words',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border border-border'
          )}
        >
          {/* Render content with markdown support */}
          <div className={cn('prose prose-sm max-w-none', isUser ? 'prose-invert' : 'dark:prose-invert')}>
            <ReactMarkdown
              components={{
                code({ className, children }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';

                  return language ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={language}
                      PreTag="div"
                      className="rounded-md text-sm"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className={cn(
                        'px-1.5 py-0.5 rounded text-sm font-mono',
                        isUser
                          ? 'bg-primary-foreground/20'
                          : 'bg-muted'
                      )}
                    >
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <div className="my-2">{children}</div>;
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="list-disc pl-4 mb-2">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="list-decimal pl-4 mb-2">{children}</ol>;
                },
                li({ children }) {
                  return <li className="mb-1">{children}</li>;
                },
              }}
            >
              {turn.content_plain || turn.content}
            </ReactMarkdown>
          </div>

          {/* Timestamp */}
          <div
            className={cn(
              'text-xs mt-2 pt-2 border-t',
              isUser
                ? 'opacity-70 border-primary-foreground/20'
                : 'text-muted-foreground border-border/50'
            )}
          >
            {formatTime(turn.timestamp)}
          </div>

          {/* Token annotation — both user and assistant messages */}
          {turn.tokens && (() => {
            const inputTokens = turn.tokens.input_tokens ?? 0;
            const outputTokens = turn.tokens.output_tokens ?? 0;
            const showSystemHint = isUser && inputTokens > 50;
            return (
              <div className={cn(
                'text-xs mt-1 flex items-center gap-1.5 flex-wrap',
                isUser ? 'opacity-70' : 'text-muted-foreground/60'
              )}>
                {/* Input tokens */}
                <span
                  className="relative cursor-help"
                  onMouseEnter={() => setTooltip('input')}
                  onMouseLeave={() => setTooltip(null)}
                >
                  ↑ {formatTokens(inputTokens)}
                  {tooltip === 'input' && (
                    <span className="absolute bottom-full left-0 mb-2 w-48 rounded-md bg-popover border border-border px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-md z-50 whitespace-normal">
                      Input tokens — context sent to the model for this turn
                    </span>
                  )}
                </span>

                {/* System prompt hint icon */}
                {showSystemHint && (
                  <span
                    className="relative cursor-help"
                    onMouseEnter={() => setTooltip('hint')}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <Info className="h-3 w-3 opacity-50" />
                    {tooltip === 'hint' && (
                      <span className="absolute bottom-full right-0 mb-2 w-56 rounded-md bg-popover border border-border px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-md z-50 whitespace-normal">
                        Includes system prompt tokens — Claude Code injects its full instructions on the first message of every run
                      </span>
                    )}
                  </span>
                )}

                {/* Output tokens */}
                {outputTokens > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span
                      className="relative cursor-help"
                      onMouseEnter={() => setTooltip('output')}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      ↓ {formatTokens(outputTokens)}
                      {tooltip === 'output' && (
                        <span className="absolute bottom-full left-0 mb-2 w-48 rounded-md bg-popover border border-border px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-md z-50 whitespace-normal">
                          Output tokens — text generated by the model in this turn
                        </span>
                      )}
                    </span>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-accent flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
