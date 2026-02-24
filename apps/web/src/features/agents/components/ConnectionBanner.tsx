import { AlertCircle, WifiOff } from 'lucide-react';
import type { AgentStatus } from '@marionette/shared';

interface ConnectionBannerProps {
  isConnected: boolean;
  agentStatus: AgentStatus;
  error: string | null;
}

export function ConnectionBanner({ isConnected, agentStatus, error }: ConnectionBannerProps) {
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
          <span className="text-amber-700">Agent is disconnected. Waiting for connection...</span>
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
