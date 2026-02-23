import { GlassCard } from './glass-card';
import { cn } from '../../lib/utils';
import { Terminal, Activity, Search, HelpCircle, Clock } from 'lucide-react';

interface Command {
  name: string;
  description: string;
  category: 'context' | 'debug' | 'control' | 'query';
}

const COMMANDS: Command[] = [
  {
    name: '/context',
    description: 'Get agent working directory, current task, and recent activity',
    category: 'context',
  },
  {
    name: '/status',
    description: 'Get agent health metrics (tokens, errors, uptime)',
    category: 'context',
  },
  {
    name: '/inspect',
    description: 'Deep inspection of agent state and thinking process',
    category: 'debug',
  },
  {
    name: '/history',
    description: 'Get message history with the agent',
    category: 'query',
  },
  {
    name: '/help',
    description: 'List all available commands',
    category: 'query',
  },
];

const CATEGORY_ICONS = {
  context: Activity,
  debug: Search,
  control: Terminal,
  query: HelpCircle,
};

const CATEGORY_COLORS = {
  context: 'text-indigo-500',
  debug: 'text-amber-500',
  control: 'text-emerald-500',
  query: 'text-cyan-500',
};

interface CommandAutocompleteProps {
  input: string;
  onSelect: (command: string) => void;
  className?: string;
}

export function CommandAutocomplete({
  input,
  onSelect,
  className,
}: CommandAutocompleteProps) {
  // Filter commands based on input
  const query = input.slice(1).toLowerCase(); // Remove leading '/'
  const filtered = COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    return null;
  }

  return (
    <GlassCard
      className={cn(
        'absolute bottom-full left-0 right-0 mb-2 max-h-[300px] overflow-y-auto border shadow-lg',
        className
      )}
    >
      <div className="p-2">
        {/* Header */}
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Available Commands
        </div>

        {/* Command List */}
        <div className="space-y-1">
          {filtered.map((cmd) => {
            const Icon = CATEGORY_ICONS[cmd.category];
            const colorClass = CATEGORY_COLORS[cmd.category];

            return (
              <button
                key={cmd.name}
                onClick={() => onSelect(cmd.name)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md',
                  'hover:bg-accent transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 shrink-0', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {cmd.name}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs',
                          'bg-muted text-muted-foreground'
                        )}
                      >
                        {cmd.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cmd.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="mt-2 pt-2 border-t border-border/50 px-2 text-xs text-muted-foreground">
          Press Enter to use command • Tab to autocomplete
        </div>
      </div>
    </GlassCard>
  );
}
