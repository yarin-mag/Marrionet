# Marionette Web Architecture

## 📁 Folder Structure

```
src/
├── app/                      # Application entry point
│   ├── App.tsx              # Root component
│   └── globals.css          # Global styles & design system
│
├── components/              # Shared UI components
│   └── ui/                  # Reusable UI primitives
│       ├── badge.tsx        # Badge component with variants
│       ├── button.tsx       # Button with loading states
│       ├── card.tsx         # Card with elevation system
│       ├── dialog.tsx       # Modal dialog
│       ├── sheet.tsx        # Slide-out panel
│       ├── skeleton.tsx     # Loading skeletons
│       ├── empty-state.tsx  # Empty state component
│       ├── stat-card.tsx    # Dashboard stat cards
│       └── ...
│
├── features/                # Feature-based modules
│   ├── agents/             # Agent management feature
│   │   ├── components/     # Agent-specific components
│   │   │   ├── index.ts    # Barrel export
│   │   │   ├── AgentCard.tsx
│   │   │   ├── AgentDetailPanel.tsx
│   │   │   └── ...
│   │   ├── hooks/          # Agent-specific hooks
│   │   │   ├── index.ts    # Barrel export
│   │   │   ├── useAgentDisplay.ts
│   │   │   ├── useAgentUpdate.ts
│   │   │   └── useAgents.ts
│   │   └── stores/         # Agent state management
│   │       ├── agents.store.ts
│   │       └── agent-messenger.store.ts
│   │
│   ├── dashboard/          # Dashboard feature
│   │   ├── components/     # Dashboard components
│   │   │   ├── index.ts    # Barrel export
│   │   │   ├── MissionControl.tsx
│   │   │   └── DashboardStats.tsx
│   │   ├── hooks/          # Dashboard hooks
│   │   │   ├── index.ts    # Barrel export
│   │   │   └── useDashboardStats.ts
│   │   └── views/          # Dashboard views
│   │       ├── GridView.tsx
│   │       ├── TableView.tsx
│   │       ├── KanbanView.tsx
│   │       ├── CalendarView.tsx
│   │       └── AnalyticsView.tsx
│   │
│   ├── settings/           # Settings feature
│   └── theme/              # Theme management
│
├── hooks/                   # Shared custom hooks
│   ├── index.ts            # Barrel export
│   ├── useDebounce.ts      # Generic debounce hook
│   ├── useMediaQuery.ts    # Responsive breakpoints
│   └── ...
│
├── lib/                     # Utilities & config
│   ├── index.ts            # Barrel export
│   ├── utils.ts            # Helper functions
│   ├── constants.ts        # App constants
│   ├── status-config.ts    # Status color config
│   └── query-client.ts     # React Query setup
│
└── services/                # External services
    ├── api.service.ts      # API client
    ├── ws.service.ts       # WebSocket client
    └── db.service.ts       # IndexedDB client
```

---

## 🎨 Design System

### Color System

Located in `app/globals.css`, our design system includes:

**Status Colors:**
- Success: `hsl(142 71% 45%)` - Green
- Warning: `hsl(38 92% 50%)` - Orange
- Error: `hsl(0 84% 60%)` - Red
- Info: `hsl(199 89% 48%)` - Cyan
- Primary: `hsl(213 94% 68%)` - Blue

**Shadow System:**
- `shadow-xs` → `shadow-2xl` (6 levels)

**Spacing Scale:**
- 8px base grid: `xs` (4px) → `4xl` (64px)

**Typography Utilities:**
- `.text-display-lg/md` - Headlines
- `.text-heading-lg/md/sm` - Section headers
- `.text-body-lg/md/sm` - Content
- `.text-label` - Uppercase labels

---

## 📐 Component Guidelines

### File Size Limits
- ✅ **Max 200 lines per file**
- ✅ **Max 50 lines per function**
- ⚠️ If exceeding, split into multiple files

### Component Structure
```typescript
import { ... } from "...";

interface ComponentProps {
  /** JSDoc for each prop */
  prop: string;
}

/**
 * Component description
 * @example
 * <Component prop="value" />
 */
export function Component({ prop }: ComponentProps) {
  // Component logic
}
```

### Naming Conventions
- **Components:** PascalCase (`AgentCard`)
- **Hooks:** camelCase with `use` prefix (`useAgentDisplay`)
- **Files:** Match component name (`AgentCard.tsx`)
- **Types:** PascalCase with suffix (`AgentCardProps`)

---

## 🪝 Custom Hooks Pattern

### Extract Business Logic
```typescript
// ❌ Bad: Logic in component
function AgentCard({ agent }) {
  const folder = extractFolder(agent.cwd);
  const displayName = agent.metadata?.custom_name || agent.agent_name || folder;
  // ...
}

// ✅ Good: Logic in hook
function useAgentDisplay(agent) {
  const folder = extractFolder(agent.cwd);
  const displayName = agent.metadata?.custom_name || agent.agent_name || folder;
  return { displayName, folder };
}
```

### Hook Guidelines
- ✅ Single responsibility
- ✅ Reusable across components
- ✅ Proper TypeScript interfaces
- ✅ JSDoc comments

---

## 🎯 Best Practices

### Imports
```typescript
// ✅ Use barrel exports
import { AgentCard, AgentDetailPanel } from "@/features/agents/components";
import { useDebounce } from "@/hooks";

// ❌ Avoid deep imports
import { AgentCard } from "@/features/agents/components/AgentCard";
```

### Component Reusability
```typescript
// ✅ Generic, reusable
function StatCard({ label, value, icon, variant }) { ... }

// ❌ One-off, specific
function AgentStatCard({ agent }) { ... }
```

### TypeScript
```typescript
// ✅ Proper interfaces
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

// ✅ Generic hooks
function useStatusColors<T extends string>(
  status: T,
  colorMap: Record<T, StatusColor>
): StatusColor { ... }
```

### State Management
- **Zustand stores:** Feature-specific state (`agents.store.ts`)
- **React Query:** Server state (`useQuery`, `useMutation`)
- **Local state:** Component-only state (`useState`)

---

## 🚀 Adding New Features

### 1. Create Feature Folder
```
features/my-feature/
├── components/
│   ├── index.ts
│   └── MyComponent.tsx
├── hooks/
│   ├── index.ts
│   └── useMyFeature.ts
└── stores/
    └── my-feature.store.ts
```

### 2. Create Barrel Exports
```typescript
// features/my-feature/components/index.ts
export { MyComponent } from "./MyComponent";
```

### 3. Follow Conventions
- ✅ Max 200 lines per file
- ✅ Extract hooks for business logic
- ✅ Use design system utilities
- ✅ Add JSDoc comments
- ✅ Proper TypeScript types

---

## 🧪 Testing Strategy

- **Unit tests:** For hooks and utilities
- **Integration tests:** For complex components
- **E2E tests:** For critical user flows

---

## 📚 Key Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Zustand** - Client state management
- **React Query** - Server state management
- **Recharts** - Data visualization
- **Radix UI** - Accessible primitives
- **Lucide React** - Icon library

---

## 🎓 Learning Resources

- [React Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Radix UI Docs](https://www.radix-ui.com/primitives)

---

**Last Updated:** 2026-02-19
