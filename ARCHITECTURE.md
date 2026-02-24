# Marionette Complete Architecture & Runtime Flow

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S TERMINAL                              │
│                                                                       │
│  $ claude chat                                                       │
│         ↓                                                            │
│  [Shell alias intercepts]                                            │
│         ↓                                                            │
│  Actually runs: claude-wrapper chat                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE WRAPPER PROCESS                            │
│                    (Node.js - TypeScript)                            │
│                                                                       │
│  1. Spawns actual Claude CLI as child process                       │
│  2. Captures stdin/stdout (conversation)                            │
│  3. Monitors system activities                                      │
│  4. Streams events to backend via WebSocket                         │
│                                                                       │
│  ┌─────────────────┐                                                │
│  │ Message Capture │  → Buffers user & Claude messages             │
│  ├─────────────────┤                                                │
│  │ Process Monitor │  → Tracks spawned processes                   │
│  ├─────────────────┤                                                │
│  │ Network Monitor │  → Captures HTTP/HTTPS requests               │
│  ├─────────────────┤                                                │
│  │ Filesystem Mon. │  → Watches file changes                       │
│  ├─────────────────┤                                                │
│  │ Performance Mon.│  → CPU/Memory stats                           │
│  └─────────────────┘                                                │
│         │                                                            │
│         │ WebSocket Connection (ws://localhost:8787/agent-stream)   │
│         ▼                                                            │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ Events Stream (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND SERVER                                 │
│                    (Node.js - Express + WS)                          │
│                    PORT: 8787                                        │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  WebSocket Server (/agent-stream)                            │  │
│  │  • Receives events from wrappers                             │  │
│  │  • Broadcasts to web dashboard                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Event Processor                                             │  │
│  │  • Validates events                                          │  │
│  │  • Enriches with metadata                                    │  │
│  │  • Saves to database                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Database Connection                                         │  │
│  │  • Type: SQLite (default) or PostgreSQL                     │  │
│  │  • Connection: File handle (SQLite) or TCP (PostgreSQL)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              │ Writes to database
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite)                                 │
│                                                                       │
│  File: db/marionette.db                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  • Embedded in backend process (no server!)                 │    │
│  │  • Reads/writes via file system                             │    │
│  │  • Size: Starts at 40KB, grows ~30KB per conversation       │    │
│  │  • Fast: < 1ms reads, < 5ms writes                          │    │
│  │  • Reliable: Battle-tested, zero configuration              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Tables:                                                             │
│  • agents, conversations, messages                                  │
│  • events, processes, network_requests                              │
│  • filesystem_changes, performance_stats, heartbeats                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              │ Backend reads from database
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND SERVER (continued)                     │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  REST API (HTTP)                                             │  │
│  │  GET  /api/agents          → List all agents                │  │
│  │  GET  /api/agents/:id      → Get agent details              │  │
│  │  GET  /api/conversations   → List conversations             │  │
│  │  GET  /api/messages        → Get conversation messages      │  │
│  │  GET  /api/events          → Get monitoring events          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             │ HTTP Responses (JSON)                  │
│                             ▼                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       WEB DASHBOARD                                  │
│                    (React + Vite)                                    │
│                    PORT: 3000                                        │
│                                                                       │
│  Browser: http://localhost:3000                                     │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Active Agents View                                          │  │
│  │  • Real-time list of running wrappers                        │  │
│  │  • Status, uptime, memory usage                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Conversation View                                           │  │
│  │  • User messages + Claude responses                          │  │
│  │  • Syntax highlighting                                       │  │
│  │  • Timestamps                                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Events Timeline                                             │  │
│  │  • Process spawns                                            │  │
│  │  • Network requests                                          │  │
│  │  • File changes                                              │  │
│  │  • Performance metrics                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Analytics Dashboard                                         │  │
│  │  • Usage graphs                                              │  │
│  │  • Response time charts                                      │  │
│  │  • Error rates                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Runtime Flow

### 1. Installation Phase

```bash
$ ./setup.sh
```

```
[Install Script]
      │
      ├──> Install all dependencies (npm install)
      │
      ├──> Build wrapper (scripts/dist/)
      │
      ├──> Link wrapper globally (/usr/local/bin/claude-wrapper)
      │
      ├──> Create database file (db/marionette.db)
      │    └──> sqlite3 marionette.db < schema.sql
      │         └──> Creates 10 tables + indexes
      │
      ├──> Configure shell alias (claude → claude-wrapper)
      │
      └──> Setup complete!
```

### 2. Backend Startup

```bash
$ cd backend && npm run dev
```

```
[Backend Process Starts]
      │
      ├──> Read .env configuration
      │    └──> DATABASE_URL=sqlite:../db/marionette.db
      │
      ├──> Connect to database
      │    └──> Open SQLite file handle
      │         └──> File: ../db/marionette.db
      │         └──> No separate process needed
      │         └──> ✓ Database connected (SQLite)
      │
      ├──> Run migrations
      │    └──> Check schema_migrations table
      │    └──> ✓ Migrations up to date (v1)
      │
      ├──> Start HTTP server
      │    └──> ✓ HTTP server listening on :8787
      │
      ├──> Start WebSocket server
      │    └──> ✓ WebSocket ready at ws://localhost:8787/agent-stream
      │
      └──> ✓ Backend ready!
```

**Database at this point:**
- SQLite file exists at `db/marionette.db`
- Contains 10 empty tables
- Backend has open file handle
- Ready to accept writes

### 3. Web Dashboard Startup

```bash
$ cd web && npm run dev
```

```
[Web Dev Server Starts]
      │
      ├──> Read .env configuration
      │    └──> VITE_API_URL=http://localhost:8787
      │
      ├──> Build React app
      │
      ├──> Start Vite dev server
      │    └──> ✓ Ready at http://localhost:3000
      │
      └──> Open browser → http://localhost:3000
           │
           └──> Dashboard loads (empty initially)
```

### 4. User Runs Claude

```bash
$ claude chat
```

```
[Shell Alias Triggers]
      │
      └──> Actually runs: claude-wrapper chat

[Claude Wrapper Starts]
      │
      ├──> Generate IDs
      │    ├──> Agent ID: agent_1708387200_abc123
      │    └──> Session ID: session_1708387200_def456
      │
      ├──> Connect to backend WebSocket
      │    └──> ws://localhost:8787/agent-stream
      │    └──> ✓ Connected to Marionette backend
      │
      ├──> Emit: agent_started event
      │    └──> Sent to backend via WebSocket
      │
      ├──> Initialize monitors
      │    ├──> Process monitor (hooks child_process.spawn)
      │    ├──> Network monitor (hooks http/https)
      │    ├──> Filesystem monitor (starts chokidar)
      │    └──> Performance monitor (starts pidusage)
      │
      ├──> Start heartbeat (every 30s)
      │
      ├──> Spawn actual Claude CLI
      │    └──> child_process.spawn('claude', ['chat'])
      │
      ├──> Display banner to user
      │
      └──> Start capturing I/O
           ├──> User types → captured → sent to Claude
           └──> Claude responds → captured → sent to backend
```

### 5. Event Flow (Real-time)

```
[User types in terminal]
      │
      ▼
[Wrapper captures input]
      │
      ├──> Forward to Claude CLI (user sees normal behavior)
      │
      └──> Buffer message (500ms accumulation)
           │
           └──> Timeout expires
                │
                ▼
           [Create conversation_turn event]
                │
                └──> Send via WebSocket
                     │
                     ▼
           [Backend receives event]
                │
                ├──> Validate event
                │
                ├──> Save to database
                │    │
                │    └──> INSERT INTO messages (...)
                │         └──> SQLite: Write to file
                │              (or PostgreSQL: Send to server)
                │
                └──> Broadcast to web dashboard
                     │
                     ▼
           [Web dashboard updates]
                │
                └──> New message appears in UI
                     (Real-time, < 100ms total latency)
```

### 6. Database Write Flow (SQLite)

```
[Backend receives event]
      │
      ▼
[Event processor validates]
      │
      ▼
[Database query executed]
      │
      └──> db.run("INSERT INTO messages (...)")
           │
           ▼
      [SQLite library]
           │
           ├──> Opens db/marionette.db (already open)
           │
           ├──> Writes to file
           │    └──> File system write
           │         └──> fsync() to ensure durability
           │
           ├──> Updates indexes
           │
           └──> Returns success
                │
                ▼
      [Backend confirms write]
           │
           └──> Continue processing
```

### 7. Database Read Flow

```
[User opens dashboard]
      │
      ▼
[Web dashboard requests data]
      │
      └──> GET http://localhost:8787/api/conversations
           │
           ▼
      [Backend handles request]
           │
           └──> db.all("SELECT * FROM conversations WHERE ...")
                │
                ▼
           [SQLite library]
                │
                ├──> Reads from db/marionette.db
                │
                ├──> Uses indexes for fast lookup
                │
                └──> Returns rows
                     │
                     ▼
           [Backend formats response]
                │
                └──> res.json({ conversations: [...] })
                     │
                     ▼
           [Web dashboard displays data]
```

---

## 📊 Process Overview

### What's Running (3 Processes)

```bash
$ ps aux | grep marionette
```

**Output:**
```
user  12345  node backend/dist/index.js     # Backend server
user  12346  node web/node_modules/.bin/vite  # Web dev server
user  12347  node /usr/local/bin/claude-wrapper  # Wrapper (per Claude session)
```

**Database:**
- **SQLite**: No separate process (embedded in backend)
- **PostgreSQL**: Separate `postgres` process (if using PostgreSQL)

### Port Usage

- **3000** - Web dashboard (HTTP)
- **8787** - Backend API (HTTP) + WebSocket
- **5432** - PostgreSQL (if using, TCP)

### File System

```
marionette/
├── backend/
│   ├── node_modules/       # Dependencies
│   ├── dist/               # Compiled JS
│   └── logs/               # Log files
│
├── web/
│   ├── node_modules/       # Dependencies
│   └── dist/               # Built assets (production)
│
├── scripts/
│   ├── node_modules/       # Dependencies
│   └── dist/               # Compiled wrapper
│
└── db/
    ├── marionette.db        # SQLite database (grows over time)
    └── marionette.db-wal    # SQLite WAL file (if WAL mode enabled)
```

---

## 🎯 Key Takeaways

### Database Runtime (SQLite)

1. **No separate database server** - it's just a file
2. **Automatically created** during installation
3. **Automatically opened** when backend starts
4. **Embedded in backend** - same process
5. **Works immediately** - zero configuration

### Database Runtime (PostgreSQL)

1. **Separate server required** - must start it first
2. **Manual setup needed** - create DB, run schema
3. **Backend connects via TCP** - network connection
4. **Production ready** - better for scale

### For New Users

**They don't need to think about the database at all!**

```bash
git clone repo
./setup.sh        # ← Database automatically set up here
cd backend && npm run dev  # ← Database automatically connected here
cd web && npm run dev
claude chat         # ← Everything just works!
```

The database runs **automatically** as part of the backend. No separate commands needed! 🎉
