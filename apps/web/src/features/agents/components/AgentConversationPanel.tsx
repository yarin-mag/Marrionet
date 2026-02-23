import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useAgentConversation } from '../hooks/useAgentConversation';
import { ConversationMessage } from './ConversationMessage';

interface AgentConversationPanelProps {
  agentId: string;
}

export function AgentConversationPanel({ agentId }: AgentConversationPanelProps) {
  const { conversation, isLoading, isConnected, sendMessage, error } = useAgentConversation(agentId);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.turns]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      await sendMessage(inputValue);
      setInputValue('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-card flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Conversation</h2>
          <p className="text-sm text-muted-foreground">
            {conversation.turn_count} {conversation.turn_count === 1 ? 'message' : 'messages'}
            {conversation.session_id && (
              <span className="ml-2 text-xs">
                Session: {conversation.session_id.split('_').pop()?.slice(0, 8)}
              </span>
            )}
          </p>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Wifi className="h-4 w-4" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
              <WifiOff className="h-4 w-4" />
              <span>Reconnecting...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {conversation.turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="max-w-md space-y-2">
              <p className="text-muted-foreground">
                No conversation yet. Send a message to start chatting with the agent.
              </p>
              <p className="text-xs text-muted-foreground">
                Messages you send here will be injected into the agent's terminal input.
              </p>
            </div>
          </div>
        ) : (
          <>
            {conversation.turns.map((turn) => (
              <ConversationMessage key={turn.id} turn={turn} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t bg-card">
        {sendError && (
          <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{sendError}</span>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message to send to the agent..."
            className={cn(
              'flex-1 min-h-[60px] max-h-[200px] px-4 py-3 rounded-lg border border-border bg-background',
              'resize-none focus:outline-none focus:ring-2 focus:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'placeholder:text-muted-foreground'
            )}
            disabled={isSending || !isConnected}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || !isConnected}
            size="lg"
            className="self-end h-[60px] px-6"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send,{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd> for new line
          </p>
          {!isConnected && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Messages will be sent when reconnected
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
