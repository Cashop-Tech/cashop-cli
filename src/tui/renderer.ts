import type { SseEvent } from '../types/chat.js';

export interface RenderSinks {
  out: (s: string) => void;
  err: (s: string) => void;
}

export interface RenderOpts {
  json: boolean;      // global --json mode
  color?: boolean;    // default true
  verbose?: boolean;
}

const DIM = (s: string, on: boolean) => on ? `\u001b[2m${s}\u001b[0m` : s;
const RED = (s: string, on: boolean) => on ? `\u001b[31m${s}\u001b[0m` : s;
const YEL = (s: string, on: boolean) => on ? `\u001b[33m${s}\u001b[0m` : s;

export function renderEvent(ev: SseEvent, sinks: RenderSinks, opts: RenderOpts): void {
  if (opts.json) { sinks.out(JSON.stringify(ev)); return; }
  const color = opts.color !== false;
  switch (ev.type) {
    case 'text_delta':
      if (typeof ev.content === 'string') sinks.out(ev.content);
      break;
    case 'typing':
      sinks.err(DIM(`· ${ev.content ?? ''}\n`, color));
      break;
    case 'suggestions': {
      const qs = ev.questions ?? [];
      if (qs.length) {
        const lines = qs.map((q, i) => `  [${i + 1}] ${q}`).join('\n');
        sinks.out(`\nTry:\n${lines}\n`);
      }
      break;
    }
    case 'shopping_cart':
      sinks.out(`\n[cart] ${JSON.stringify(ev.cart ?? {})}\n`);
      break;
    case 'system_notification':
      sinks.err(YEL(`! ${ev.message ?? ev.content ?? ''}\n`, color));
      break;
    case 'session_expired':
      sinks.err(RED(`session expired\n`, color));
      break;
    case 'error':
      sinks.err(RED(`x ${ev.message ?? 'error'}\n`, color));
      break;
    case 'session_start':
    case 'done':
      if (opts.verbose) sinks.err(DIM(`[${ev.type}] ${ev.session_id ?? ''}\n`, color));
      break;
    default:
      if (opts.verbose) sinks.err(DIM(`[unknown] ${JSON.stringify(ev)}\n`, color));
  }
}
