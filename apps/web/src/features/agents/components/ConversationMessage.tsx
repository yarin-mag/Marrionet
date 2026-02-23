import { Bot, User } from 'lucide-react';
import type { ConversationTurn } from '@marionette/shared';
import { cn } from '../../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ConversationMessageProps {
  turn: ConversationTurn;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export function ConversationMessage({ turn }: ConversationMessageProps) {
  const isUser = turn.role === 'user';
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
          <div className={cn('prose prose-sm max-w-none', isUser && 'prose-invert')}>
            <ReactMarkdown
              components={{
                code({ node, className, children }) {
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
