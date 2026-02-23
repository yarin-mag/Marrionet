/**
 * Message types for conversation capture
 */

export type MessageRole = 'user' | 'assistant';
export type MessageDirection = 'to_agent' | 'from_agent';
export type MessageSource = 'terminal' | 'web';

export interface Message {
  id: string;
  agent_id: string;
  session_id: string;
  direction: MessageDirection;
  role: MessageRole;
  content: string;
  content_plain: string;
  timestamp: string;
  source?: MessageSource;
}
