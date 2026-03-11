import { useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAgentConversation } from '../hooks/useAgentConversation';
import { ConversationMessage } from './ConversationMessage';
import { formatTokens } from '../../../lib/utils';

function formatCost(usd: number): string {
  if (!isFinite(usd) || usd === 0) return "$0.00";
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

interface AgentConversationPanelProps {
  agentId: string;
}

export function AgentConversationPanel({ agentId }: AgentConversationPanelProps) {
  const { turns, totals, isLoading, error } = useAgentConversation(agentId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

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

  const hasTotals = totals && (totals.input_tokens > 0 || totals.output_tokens > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <h2 className="text-lg font-semibold">Conversation</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {turns.length} {turns.length === 1 ? 'message' : 'messages'}
          </p>
          {hasTotals && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ↑ {formatTokens(totals.input_tokens)} · ↓ {formatTokens(totals.output_tokens)}
              </span>
              <span className="text-xs text-emerald-500/80 tabular-nums font-medium">
                {formatCost(totals.cost_usd)}
              </span>
            </>
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
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground">No conversation recorded yet.</p>
          </div>
        ) : (
          <>
            {turns.map((turn) => (
              <ConversationMessage key={turn.id} turn={turn} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
}
