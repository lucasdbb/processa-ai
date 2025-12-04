declare module '@processa-ai/types/chat' {
  export type Role = 'user' | 'assistant' | 'system';
  export interface ChatMessage {
    id: string;
    role: Role;
    content: string;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }
  export interface ChatSession {
    id: string;
    title?: string;
    createdAt?: string;
    messages?: ChatMessage[];
    metadata?: Record<string, unknown>;
  }
  export interface StreamingMessage {
    id: string;
    role: 'assistant';
    delta: string;
    done?: boolean;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }
}
