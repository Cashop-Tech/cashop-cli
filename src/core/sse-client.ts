import { NetworkError } from './errors.js';
import type { ChatRequest, SseEvent } from '../types/chat.js';

export interface StreamChatOpts {
  base: string;
  token: string;
  body: ChatRequest;
  signal?: AbortSignal;              // caller 取消
  headers?: Record<string, string>;
  connectTimeoutMs?: number;         // 默认 10_000
  idleTimeoutMs?: number;             // 默认 60_000
}

const PATH = '/ai/cashop-ai/rpc/auth/chat/message';
const DEFAULT_CONNECT_MS = 10_000;
const DEFAULT_IDLE_MS = 60_000;

export async function* streamChat(opts: StreamChatOpts): AsyncGenerator<SseEvent> {
  const connectMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_MS;
  const idleMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_MS;

  // 1) Connect-phase abort controller：fetch 返回 headers 后即清
  const connectAc = new AbortController();
  const connectTimer = setTimeout(() => connectAc.abort(new Error('connect timeout')), connectMs);
  const composed = composeSignals(connectAc.signal, opts.signal);

  let res: Response;
  try {
    res = await fetch(`${opts.base}${PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: opts.token,
        'X-Country': 'JP', 'X-Currency': 'JPY', 'X-Language': 'en',
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(opts.body),
      signal: composed,
    });
  } catch (e: any) {
    clearTimeout(connectTimer);
    if (e?.name === 'AbortError') throw new NetworkError(`sse: connect timeout after ${connectMs}ms`);
    throw new NetworkError(`sse: ${e?.message ?? String(e)}`);
  }
  clearTimeout(connectTimer);

  if (!res.ok) throw new NetworkError(`HTTP ${res.status} from ${PATH}`);
  if (!res.body) throw new NetworkError('sse: empty body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  // 2) Idle watchdog：每收一条 event 重置，超时则 cancel reader
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let idleExpired = false;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleExpired = true;
      reader.cancel(new Error('idle timeout')).catch(() => {});
    }, idleMs);
  };
  resetIdle();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = parseBlock(block);
        if (ev) {
          resetIdle();
          yield ev;
        }
      }
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
  if (idleExpired) throw new NetworkError(`sse: idle timeout after ${idleMs}ms`);
}

function parseBlock(block: string): SseEvent | null {
  const lines = block.split('\n').map(s => s.trimEnd());
  let data = '';
  for (const line of lines) {
    if (line.startsWith('data:')) data += line.slice(5).trimStart();
  }
  if (!data) return null;
  try { return JSON.parse(data) as SseEvent; }
  catch { return null; }
}

function composeSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  const ac = new AbortController();
  const onA = () => ac.abort(a.reason);
  const onB = () => ac.abort(b.reason);
  if (a.aborted) ac.abort(a.reason);
  else a.addEventListener('abort', onA, { once: true });
  if (b.aborted) ac.abort(b.reason);
  else b.addEventListener('abort', onB, { once: true });
  return ac.signal;
}
