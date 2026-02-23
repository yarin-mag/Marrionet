import { useState, useRef, useEffect } from 'react';
import { useAgentMessaging } from '../../../hooks/use-agent-messaging';
import { MessageBubble } from '../../../components/ui/message-bubble';
import { MessageInput } from '../../../components/ui/message-input';
import { CommandAutocomplete } from '../../../components/ui/command-autocomplete';
import { GlassCard } from '../../../components/ui/glass-card';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { AgentStatus } from '@marionette/shared';

interface AgentMessengerProps {
  agentId: string;
  agentName?: string;
  status: AgentStatus;
}

export function AgentMessenger({ agentId, agentName, status }: AgentMessengerProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isConnected,
    isTyping,
    isSending,
    sendMessage,
    error,
  } = useAgentMessaging(agentId);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  /**
   * Handle send message
   */
  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    await sendMessage(inputValue);
    setInputValue('');
  };

  /**
   * Handle command selection from autocomplete
   */
  const handleCommandSelect = (command: string) => {
    setInputValue(command + ' ');
  };

  // Check if input starts with '/' for command autocomplete
  const showAutocomplete = inputValue.startsWith('/') && inputValue.length > 1;

  return (
    <div className="flex flex-col h-[600px]">
      {/* Connection/Status Banner */}
      <ConnectionBanner
        isConnected={isConnected}
        agentStatus={status}
        error={error}
      />

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Empty State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Loader2 className="h-8 w-8 text-muted-foreground animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Start a conversation
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Send a message or use commands like <code className="px-1 py-0.5 rounded bg-muted">/context</code> to interact with {agentName || 'the agent'}.
              </p>
            </div>
          )}

          {/* Message List */}
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive =
              prevMsg &&
              prevMsg.direction === msg.direction &&
              new Date(msg.createdAt).getTime() -
                new Date(prevMsg.createdAt).getTime() <
                60000; // Within 1 minute

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isConsecutive={isConsecutive ?? undefined}
              />
            );
          })}

          {/* Typing Indicator */}
          {isTyping && <TypingIndicator agentName={agentName} />}

          {/* Scroll Anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="relative">
        {/* Command Autocomplete */}
        {showAutocomplete && (
          <CommandAutocomplete
            input={inputValue}
            onSelect={handleCommandSelect}
          />
        )}

        {/* Message Input */}
        <MessageInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          isSending={isSending}
          disabled={!isConnected || status === 'disconnected'}
        />
      </div>
    </div>
  );
}

/**
 * Connection/Status Banner Component
 */
interface ConnectionBannerProps {
  isConnected: boolean;
  agentStatus: AgentStatus;
  error: string | null;
}

function ConnectionBanner({ isConnected, agentStatus, error }: ConnectionBannerProps) {
  if (error) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      </div>
    );
  }

  if (!isConnected || agentStatus === 'disconnected') {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="text-amber-700">
            Agent is disconnected. Waiting for connection...
          </span>
        </div>
      </div>
    );
  }

  if (agentStatus === 'working') {
    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-700">Agent is working</span>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Typing Indicator Component
 */
interface TypingIndicatorProps {
  agentName?: string;
}

function TypingIndicator({ agentName }: TypingIndicatorProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
      <GlassCard className="px-4 py-3 bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-muted-foreground">
            {agentName || 'Agent'} is thinking...
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
