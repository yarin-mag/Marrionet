import { cn } from '../../lib/utils';
import type { Message } from '@marionette/shared';
import { Bot, User, Terminal } from 'lucide-react';
import { GlassCard } from './glass-card';

interface MessageBubbleProps {
  message: Message;
  isConsecutive?: boolean;
}

export function MessageBubble({ message, isConsecutive = false }: MessageBubbleProps) {
  const isUser = message.direction === 'to_agent';
  const isSystem = message.messageType === 'system';
  const isCommand = message.messageType === 'command';
  const isResponse = message.messageType === 'response';

  // Format timestamp
  const timestamp = new Date(message.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      {!isConsecutive && (
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            isUser && 'bg-primary/10 text-primary',
            !isUser && !isSystem && 'bg-muted text-muted-foreground',
            isSystem && 'bg-amber-500/10 text-amber-600'
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : isSystem ? (
            <Terminal className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
      )}

      {/* Spacer for consecutive messages */}
      {isConsecutive && <div className="w-8 shrink-0" />}

      {/* Message Bubble */}
      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <GlassCard
          className={cn(
            'max-w-[80%] border p-3 rounded-2xl',
            isUser && 'bg-primary/10 border-primary/20',
            !isUser && !isSystem && 'bg-muted/50 border-border',
            isSystem && 'bg-amber-500/10 border-amber-500/20'
          )}
        >
          {/* Command Badge */}
          {(isCommand || isResponse) && (
            <div className="mb-2 flex items-center gap-2">
              <div
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-mono',
                  isCommand && 'bg-primary/20 text-primary',
                  isResponse && 'bg-emerald-500/20 text-emerald-700'
                )}
              >
                {isCommand ? 'Command' : 'Response'}
              </div>
              {message.metadata?.command && (
                <span className="text-xs font-mono text-muted-foreground">
                  {message.metadata.command}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="text-sm">
            {isResponse ? (
              <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto">
                {formatResponse(message.content)}
              </pre>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>

          {/* Metadata */}
          {message.metadata?.executionTimeMs && (
            <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              Executed in {message.metadata.executionTimeMs}ms
            </div>
          )}

          {/* Error Display */}
          {message.messageType === 'error' && message.metadata?.error && (
            <div className="mt-2 pt-2 border-t border-red-500/20 text-xs text-red-600">
              ⚠️ {message.metadata.error.message}
            </div>
          )}
        </GlassCard>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground px-2">{timestamp}</span>
      </div>
    </div>
  );
}

/**
 * Format response content (pretty-print JSON)
 */
function formatResponse(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}
