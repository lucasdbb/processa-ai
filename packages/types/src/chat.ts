/**
 * Chat & AI Types
 */

export interface ChatSession {
  id: string;
  user_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at: string;
}

export interface StreamingMessage {
  type: 'token' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface ChatRequest {
  session_id?: string;
  message: string;
  context?: string;
}

export interface ChatResponse {
  session_id: string;
  message: ChatMessage;
}
