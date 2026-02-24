import { useState, useRef, useEffect } from 'react';
import { useAgentMessaging } from '../../../hooks/use-agent-messaging';
import { MessageBubble } from '../../../components/ui/message-bubble';
import { MessageInput } from '../../../components/ui/message-input';
import { CommandAutocomplete } from '../../../components/ui/command-autocomplete';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { ConnectionBanner } from './ConnectionBanner';
import { TypingIndicator } from './TypingIndicator';
import type { AgentStatus } from '@marionette/shared';

const CONSECUTIVE_MSG_THRESHOLD_MS = 60_000;
const MIN_COMMAND_AUTOCOMPLETE_LENGTH = 2;

interface AgentMessengerProps {
  agentId: string;
  agentName?: string;
  status: AgentStatus;
}

export function AgentMessenger({ agentId, agentName, status }: AgentMessengerProps) {
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, isConnected, isTyping, isSending, sendMessage, error } = useAgentMessaging(agentId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    await sendMessage(inputValue);
    setInputValue('');
  };

  const handleCommandSelect = (command: string) => {
    setInputValue(command + ' ');
  };

  const showAutocomplete = inputValue.startsWith('/') && inputValue.length >= MIN_COMMAND_AUTOCOMPLETE_LENGTH;

  return (
    <div className="flex flex-col h-[600px]">
      <ConnectionBanner isConnected={isConnected} agentStatus={status} error={error} />

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Loader2 className="h-8 w-8 text-muted-foreground animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Send a message or use commands like{' '}
                <code className="px-1 py-0.5 rounded bg-muted">/context</code> to interact with{' '}
                {agentName || 'the agent'}.
              </p>
            </div>
          )}

          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive =
              prevMsg &&
              prevMsg.direction === msg.direction &&
              new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <
                CONSECUTIVE_MSG_THRESHOLD_MS;

            return (
              <MessageBubble key={msg.id} message={msg} isConsecutive={isConsecutive ?? undefined} />
            );
          })}

          {isTyping && <TypingIndicator agentName={agentName} />}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="relative">
        {showAutocomplete && (
          <CommandAutocomplete input={inputValue} onSelect={handleCommandSelect} />
        )}
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
