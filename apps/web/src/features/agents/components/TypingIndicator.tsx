import { Loader2 } from 'lucide-react';
import { GlassCard } from '../../../components/ui/glass-card';

interface TypingIndicatorProps {
  agentName?: string;
}

export function TypingIndicator({ agentName }: TypingIndicatorProps) {
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
