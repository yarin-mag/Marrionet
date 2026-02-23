-- Interactive Agent Messaging System
-- Enables bidirectional communication between dashboard and agents

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('to_agent', 'from_agent')),
  content TEXT NOT NULL,
  message_type VARCHAR(32) NOT NULL DEFAULT 'text',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB,
  parent_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'delivered', 'processing', 'completed', 'failed')),
  CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'command', 'response', 'error', 'system'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_messages_agent_status ON messages(agent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_agent_created ON messages(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction, status);

-- Add foreign key constraint to agents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_agent'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT fk_messages_agent
      FOREIGN KEY (agent_id)
      REFERENCES agents(agent_id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- Add comment for documentation
COMMENT ON TABLE messages IS 'Stores bidirectional messages between dashboard and agents for interactive debugging';
COMMENT ON COLUMN messages.direction IS 'Message direction: to_agent (dashboard → agent) or from_agent (agent → dashboard)';
COMMENT ON COLUMN messages.message_type IS 'Type of message: text, command, response, error, or system';
COMMENT ON COLUMN messages.status IS 'Lifecycle status: pending → delivered → processing → completed/failed';
COMMENT ON COLUMN messages.parent_message_id IS 'Links responses to original messages for conversation threading';
COMMENT ON COLUMN messages.metadata IS 'Stores command args, execution time, token counts, error details, etc.';
