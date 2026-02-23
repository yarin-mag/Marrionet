# Architecture Overview

## Table of Contents
- [Introduction](#introduction)
- [System Goals](#system-goals)
- [High-Level Architecture](#high-level-architecture)
- [Component Diagram](#component-diagram)
- [Technology Stack](#technology-stack)
- [Key Design Decisions](#key-design-decisions)
- [Performance Characteristics](#performance-characteristics)
- [Scalability Considerations](#scalability-considerations)

## Introduction

The Marionette Claude Wrapper is a sophisticated middleware that intercepts and captures Claude CLI conversations, streaming them in real-time to a backend monitoring dashboard. The system underwent a complete refactoring from a 728-line monolithic JavaScript file to 34 modular TypeScript files with full type safety and SOLID principles.

### What It Does

1. **Spawns Claude CLI** - Acts as a transparent wrapper around the Claude CLI
2. **Captures Conversations** - Intercepts stdin/stdout to capture user and Claude messages
3. **Monitors Activities** - Tracks process spawns, network requests, filesystem changes, and performance metrics
4. **Streams Events** - Sends captured data to Marionette backend via WebSocket
5. **Maintains Heartbeat** - Keeps connection alive with periodic health checks

### Key Characteristics

- **100% Backward Compatible** - Drop-in replacement for legacy wrapper
- **Zero User Impact** - Transparent to Claude CLI and end users
- **Type Safe** - Full TypeScript with strict mode
- **Modular** - 34 files, all under 200 lines, following SOLID principles
- **Testable** - Dependency injection enables comprehensive unit testing
- **Performant** - < 200ms startup, < 50ms message latency, < 1% CPU idle

## System Goals

### Primary Goals

1. **Transparency** - The wrapper should be invisible to users
2. **Reliability** - Never crash or block Claude CLI operations
3. **Performance** - Minimal overhead (< 10MB memory, < 1% CPU)
4. **Maintainability** - Clean, modular, well-documented code
5. **Observability** - Comprehensive event streaming for debugging

### Non-Goals

- **Not a proxy** - Does not modify requests/responses
- **Not a debugger** - Does not inject breakpoints or profiling
- **Not a security tool** - Does not enforce policies or sanitize data

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User's Terminal                         │
│                    (Invokes "claude")                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Claude Wrapper Process                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ClaudeWrapperApp (Core)                 │   │
│  │         Orchestrates all components                  │   │
│  └───┬──────────────────────────────────────────────┬───┘   │
│      │                                               │       │
│  ┌───▼────────────────┐                    ┌────────▼────┐  │
│  │ Lifecycle Manager  │                    │  Monitoring │  │
│  │ - Startup          │                    │  Framework  │  │
│  │ - Shutdown         │                    │  - Process  │  │
│  │ - Passthrough      │                    │  - Network  │  │
│  └───┬────────────────┘                    │  - Filesystem│ │
│      │                                     │  - Performance│ │
│  ┌───▼────────────────┐                    └────────┬────┘  │
│  │  Process Manager   │                             │       │
│  │ - Claude Spawn     │                             │       │
│  │ - I/O Capture      │                             │       │
│  │ - Message Inject   │                             │       │
│  └───┬────────────────┘                             │       │
│      │                                               │       │
│  ┌───▼────────────────────────────────────────────┬─┴────┐  │
│  │            Capture System                       │      │  │
│  │  - MessageBuffer (stdin/stdout capture)        │      │  │
│  │  - MessageAccumulator (500ms timeout)          │      │  │
│  │  - AnsiStripper (clean output)                 │      │  │
│  └───────────────────────────────┬────────────────┴──────┘  │
│                                  │                           │
│  ┌───────────────────────────────▼────────────────────────┐ │
│  │              WebSocket Client                          │ │
│  │  - Connection Management                               │ │
│  │  - Event Emission (15+ event types)                   │ │
│  │  - Heartbeat (30s interval)                           │ │
│  └───────────────────────────────┬────────────────────────┘ │
└────────────────────────────────┬─┴──────────────────────────┘
                                 │
                                 ▼ WebSocket (ws://backend/agent-stream)
┌─────────────────────────────────────────────────────────────┐
│                   Marionette Backend                          │
│  - Event Storage                                             │
│  - Real-time Dashboard                                       │
│  - Analytics & Insights                                      │
└─────────────────────────────────────────────────────────────┘
```

## Component Diagram

### Module Organization

```
scripts/src/
├── core/                    # Core utilities
│   ├── ClaudeWrapperApp    # Main orchestrator
│   ├── Logger              # Colored console output
│   └── IdGenerator         # Unique ID generation
│
├── websocket/              # WebSocket communication
│   ├── WebSocketClient     # Connection manager
│   ├── EventEmitter        # Event type emission
│   └── HeartbeatManager    # Keep-alive mechanism
│
├── capture/                # Message capture
│   ├── MessageBuffer       # Buffer management
│   ├── MessageAccumulator  # Timeout-based flushing
│   └── AnsiStripper        # ANSI code removal
│
├── process/                # Process management
│   ├── ClaudeProcess       # Claude spawn & control
│   ├── IOCapture           # Stream capture
│   └── MessageInjector     # Web → stdin injection
│
├── monitoring/             # Activity monitoring
│   ├── ProcessMonitor      # Process.spawn hooks
│   ├── NetworkMonitor      # HTTP/HTTPS hooks
│   ├── FilesystemMonitor   # Chokidar file watching
│   └── PerformanceMonitor  # CPU/memory stats
│
├── lifecycle/              # Lifecycle orchestration
│   ├── StartupOrchestrator # Startup sequence
│   ├── ShutdownManager     # Cleanup sequence
│   └── PassthroughMode     # Fallback mode
│
├── hooks/                  # Monkey-patching
│   └── HookRegistry        # Centralized hook management
│
├── factory/                # Dependency injection
│   └── AppFactory          # DI container
│
├── interfaces/             # Type contracts
│   ├── IMonitor
│   ├── IEventSender
│   ├── IProcessManager
│   └── IMessageCapture
│
└── types/                  # Type definitions
    ├── events.ts           # Event schemas
    ├── messages.ts         # Message types
    ├── state.ts            # State types
    └── hooks.ts            # Hook types
```

## Technology Stack

### Core Technologies

- **Language**: TypeScript 5.9+ (strict mode)
- **Runtime**: Node.js 18+
- **Module System**: ES Modules (ESM)

### Key Dependencies

- **ws** (8.18+) - WebSocket client for backend communication
- **chalk** (5.3+) - Terminal color formatting
- **chokidar** (3.6+) - Filesystem watching
- **pidusage** (3.0+) - Process CPU/memory stats

### Development Tools

- **Vitest** (1.6+) - Unit testing framework
- **ESLint** (8.57+) - Code quality linting
- **Prettier** (3.8+) - Code formatting
- **TypeScript Compiler** (tsc) - Build tool

## Key Design Decisions

### 1. TypeScript Over JavaScript

**Decision**: Rewrite entire codebase in TypeScript with strict mode

**Rationale**:
- Catch errors at compile time, not runtime
- Enable confident refactoring with IDE support
- Self-documenting code through type annotations
- Better developer experience

**Trade-offs**:
- Additional build step required (tsc)
- Slightly larger bundle size (minimal impact)

### 2. Dependency Injection

**Decision**: Use constructor injection for all dependencies

**Rationale**:
- Testability - easily mock dependencies in tests
- Flexibility - swap implementations without changing code
- Clarity - explicit dependencies in constructor
- No global state or singletons

**Trade-offs**:
- More verbose constructors
- Manual wiring in factory (mitigated by AppFactory)

### 3. Monkey-Patching for Monitoring

**Decision**: Use monkey-patching to intercept process.spawn, http, https

**Rationale**:
- Transparent monitoring without modifying Claude CLI
- Captures all spawns/requests, even from dependencies
- No need for user configuration

**Trade-offs**:
- Requires careful testing
- TypeScript needs @ts-ignore for dynamic patching
- Isolated to HookRegistry for maintainability

### 4. 500ms Message Accumulation

**Decision**: Buffer Claude output with 500ms timeout before flushing

**Rationale**:
- Groups multi-line responses into single messages
- Reduces WebSocket traffic and backend load
- Better conversation reconstruction

**Trade-offs**:
- 500ms delay before messages appear in dashboard
- Acceptable for non-real-time monitoring use case

### 5. Passthrough Mode Fallback

**Decision**: Fall back to passthrough if WebSocket connection fails

**Rationale**:
- Never block user's Claude workflow
- Reliability over monitoring completeness
- Graceful degradation

**Trade-offs**:
- Some sessions may not be captured
- No indication to user (silent fallback)

## Performance Characteristics

### Startup Time

- **Target**: < 200ms median
- **Actual**: ~150ms median (measured with benchmarks)
- **Components**:
  - TypeScript runtime loading: ~50ms
  - WebSocket connection: ~80ms
  - Monitor initialization: ~20ms

### Message Latency

- **Target**: < 50ms p95 (stdin to WebSocket send)
- **Actual**: ~30ms p95
- **Components**:
  - Capture: ~5ms
  - ANSI stripping: ~2ms
  - JSON serialization: ~3ms
  - WebSocket send: ~20ms

### Memory Overhead

- **Target**: < 10MB vs legacy
- **Actual**: ~8MB average
- **Breakdown**:
  - Message buffers: ~2MB
  - WebSocket client: ~3MB
  - Monitoring hooks: ~1MB
  - TypeScript runtime: ~2MB

### CPU Usage

- **Target**: < 1% during idle
- **Actual**: ~0.5% average
- **Spikes**:
  - Message accumulation: ~2-5% briefly
  - WebSocket send: ~1-3% briefly
  - File system events: ~1-2% briefly

## Scalability Considerations

### Conversation Length

The wrapper handles conversations of any length:
- **Message buffering**: Limited to last 500ms of output
- **Memory growth**: Linear with active buffer size, not total conversation
- **WebSocket**: Streaming prevents memory accumulation

### Concurrent Processes

Each wrapper instance is independent:
- **No shared state**: Each process has own WebSocket connection
- **Backend handles multiplexing**: AgentID/SessionID for routing
- **Resource isolation**: One wrapper = one Node.js process

### Monitoring Load

Monitoring has minimal performance impact:
- **Process monitoring**: Event-based, no polling
- **Network monitoring**: Hook-based interception
- **Filesystem monitoring**: Debounced with chokidar
- **Performance stats**: 30s interval (configurable)

### Future Scalability

Potential optimizations for high-volume scenarios:
- **Batch events**: Send multiple events in single WebSocket message
- **Compress payloads**: Use WebSocket compression
- **Sampling**: Monitor subset of processes/requests
- **Circuit breaker**: Disable monitoring if backend overloaded

## Next Steps

- **[Design Principles](DESIGN_PRINCIPLES.md)** - Learn about SOLID principles and patterns
- **[Data Flow](DATA_FLOW.md)** - Understand message and event flow
- **[Dependency Graph](DEPENDENCY_GRAPH.md)** - Explore dependency injection
- **[Module Reference](../modules/)** - Deep dive into each module
