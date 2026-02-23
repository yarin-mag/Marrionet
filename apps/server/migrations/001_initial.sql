-- AgentDash Schema: Agent-centric monitoring

CREATE TABLE IF NOT EXISTS agents (
  agent_id VARCHAR(64) PRIMARY KEY,
  agent_name VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'idle',
  terminal VARCHAR(64),
  cwd TEXT,
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  total_runs INT DEFAULT 0,
  total_tasks INT DEFAULT 0,
  total_errors INT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  session_start TIMESTAMP,
  session_runs INT DEFAULT 0,
  session_errors INT DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  agent_id VARCHAR(64),
  run_id VARCHAR(64) NOT NULL,
  task_id VARCHAR(128),
  type VARCHAR(64) NOT NULL,
  ts TIMESTAMP NOT NULL,
  summary TEXT,
  status VARCHAR(32),
  duration_ms BIGINT,
  tokens JSONB,
  error JSONB,
  payload JSONB,
  trace_id VARCHAR(64),
  span_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_activity ON agents(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);

-- Add foreign key constraint (with CASCADE for cleanup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_events_agent'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT fk_events_agent
      FOREIGN KEY (agent_id)
      REFERENCES agents(agent_id)
      ON DELETE CASCADE;
  END IF;
END$$;
