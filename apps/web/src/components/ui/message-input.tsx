import { forwardRef, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  (
    {
      value,
      onChange,
      onSend,
      isSending = false,
      disabled = false,
      placeholder = 'Type a message... (Shift+Enter for newline)',
      className,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    /**
     * Handle keyboard shortcuts
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter without Shift = Send
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isSending && value.trim()) {
          onSend();
        }
      }
    };

    /**
     * Auto-resize textarea based on content
     */
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
      }
    }, [value]);

    /**
     * Combined ref handling
     */
    const setRefs = (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    return (
      <div className={cn('border-t bg-card/50 backdrop-blur-sm p-4', className)}>
        <div className="relative">
          <textarea
            ref={setRefs}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            placeholder={placeholder}
            rows={1}
            className={cn(
              'w-full resize-none rounded-lg border bg-background px-4 py-3 pr-12',
              'text-sm placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all'
            )}
          />

          <Button
            onClick={onSend}
            disabled={!value.trim() || isSending || disabled}
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Hint */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Commands start with /</span>
          <span>Enter to send • Shift+Enter for new line</span>
        </div>
      </div>
    );
  }
);

MessageInput.displayName = 'MessageInput';
