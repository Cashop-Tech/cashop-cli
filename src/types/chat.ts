export interface ChatRequest {
  message?: string;
  session_id?: string;
  attachments?: Array<{ type: string; data: unknown }>;
  context_payload?: { intent?: string; source_page?: string };
}

export type SseEventType =
  | 'session_start' | 'text_delta' | 'typing' | 'suggestions'
  | 'shopping_cart' | 'system_notification' | 'session_expired'
  | 'error' | 'done';

export interface SseEvent {
  type: SseEventType;
  content?: string;
  session_id?: string;
  questions?: string[];
  cart?: unknown;
  message?: string;
  [key: string]: unknown;
}

export interface SessionMeta {
  session_id: string;
  title?: string | null;
  status?: number;
  updated_at?: string;
  created_at?: string;
  message_count?: number;
}

export interface SessionListResponse {
  sessions: SessionMeta[];
}
