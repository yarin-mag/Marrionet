-- AgentDash Database Schema

-- Agents table: tracks all Claude Code instances
CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    agent_name TEXT,
    status TEXT DEFAULT 'working' CHECK (status IN ('working', 'starting', 'blocked', 'idle', 'finished', 'disconnected', 'crashed', 'error')),
    terminal TEXT,
    cwd TEXT,
    last_activity TIMESTAMP,
    session_start TIMESTAMP,
    metadata TEXT, -- JSON
    current_run_id TEXT,
    current_task TEXT,
    total_runs INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0,
    session_runs INTEGER DEFAULT 0,
    session_errors INTEGER DEFAULT 0,
    session_tokens INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_activity ON agents(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_agents_terminal ON agents(terminal);
CREATE INDEX IF NOT EXISTS idx_agents_cwd ON agents(cwd);

-- Events table: stores all monitoring events
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    run_id TEXT,
    task_id TEXT,
    type TEXT NOT NULL,
    ts TEXT NOT NULL,
    summary TEXT,
    status TEXT,
    duration_ms INTEGER,
    tokens TEXT, -- JSON
    error TEXT,  -- JSON
    payload TEXT, -- JSON
    trace_id TEXT,
    span_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_agent_id ON events(agent_id);
CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);

-- Messages table: bidirectional messages between dashboard and agents
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('to_agent', 'from_agent')),
    message_type TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata TEXT, -- JSON
    parent_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Personal tasks table: user-created calendar notes/tasks
CREATE TABLE IF NOT EXISTS personal_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_start ON personal_tasks(start_time);
