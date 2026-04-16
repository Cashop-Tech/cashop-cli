export interface ChatRequest {
  message?: string;
  session_id?: string;
  attachments?: Array<{ type: string; data: unknown }>;
  context_payload?: { intent?: string; source_page?: string };
}

export type SseEventType =
  | 'session_start' | 'text_delta' | 'typing' | 'suggestions'
  | 'shopping_cart' | 'system_notification' | 'session_expired'
  | 'error' | 'done'
  | 'products' | 'product_detail' | 'order_card'
  | 'onboard_options' | 'promo_list' | 'address_list';

export interface ProductCard {
  spuCode?: string;
  title?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface SseEvent {
  type: SseEventType | string;
  content?: string;
  session_id?: string;
  questions?: string[];
  cart?: unknown;
  message?: string;
  scene?: string;
  one_liner?: string;
  products?: ProductCard[];
  product?: ProductCard;
  order?: unknown;
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
