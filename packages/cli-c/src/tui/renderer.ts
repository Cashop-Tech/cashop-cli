import type { SseEvent, ProductCard } from '../types/chat.js';

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
const CYA = (s: string, on: boolean) => on ? `\u001b[36m${s}\u001b[0m` : s;
const BLD = (s: string, on: boolean) => on ? `\u001b[1m${s}\u001b[0m` : s;

function formatPrice(p: ProductCard): string {
  if (typeof p.price !== 'number') return '';
  const cur = p.currency ?? '';
  return `${cur} ${p.price}`.trim();
}

function renderProductList(ev: SseEvent, sinks: RenderSinks, color: boolean): void {
  const items = (ev.products ?? []) as ProductCard[];
  if (!items.length) return;
  const title = ev.scene ? ` — ${ev.scene}` : '';
  sinks.out(`\n${BLD(`商品推荐${title}`, color)}\n`);
  if (ev.one_liner) sinks.out(`${DIM(String(ev.one_liner), color)}\n`);
  items.forEach((p, i) => {
    const line = `  [${i + 1}] ${p.title ?? '(无标题)'}`;
    const price = formatPrice(p);
    const spu = p.spuCode ? `  ${DIM(`spu=${p.spuCode}`, color)}` : '';
    sinks.out(`${line}${price ? `  ${CYA(price, color)}` : ''}${spu}\n`);
  });
  sinks.out('\n');
}

function renderProductDetail(ev: SseEvent, sinks: RenderSinks, color: boolean): void {
  const p = (ev.product ?? ev) as ProductCard;
  sinks.out(`\n${BLD('商品详情', color)}\n`);
  if (p.title) sinks.out(`  ${p.title}\n`);
  const price = formatPrice(p);
  if (price) sinks.out(`  ${CYA(price, color)}\n`);
  if (p.spuCode) sinks.out(`  ${DIM(`spu=${p.spuCode}`, color)}\n`);
  sinks.out('\n');
}

function renderOrderCard(ev: SseEvent, sinks: RenderSinks, color: boolean): void {
  const order = ev.order as Record<string, unknown> | undefined;
  if (!order) return;
  const list = (order.orders as Record<string, unknown>[] | undefined) ?? [];
  sinks.out(`\n${BLD('订单', color)}\n`);
  list.forEach((o, i) => {
    const orderNo = o.orderNo ?? o.order_no ?? '?';
    const status = o.status ?? '';
    const amount = o.amount ?? '';
    sinks.out(`  [${i + 1}] ${orderNo}  ${DIM(String(status), color)}  ${CYA(String(amount), color)}\n`);
  });
  sinks.out('\n');
}

function renderOptionList(ev: SseEvent, sinks: RenderSinks, color: boolean, label: string): void {
  const opts = (ev.options ?? ev.items ?? []) as Array<{ label?: string; text?: string; title?: string }>;
  if (!opts.length) return;
  sinks.out(`\n${BLD(label, color)}\n`);
  opts.forEach((o, i) => {
    const txt = o.label ?? o.text ?? o.title ?? JSON.stringify(o);
    sinks.out(`  [${i + 1}] ${txt}\n`);
  });
  sinks.out('\n');
}

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
    case 'products':
      renderProductList(ev, sinks, color);
      break;
    case 'product_detail':
      renderProductDetail(ev, sinks, color);
      break;
    case 'order_card':
      renderOrderCard(ev, sinks, color);
      break;
    case 'onboard_options':
      renderOptionList(ev, sinks, color, '请选择');
      break;
    case 'promo_list':
      renderOptionList(ev, sinks, color, '优惠');
      break;
    case 'address_list':
      renderOptionList(ev, sinks, color, '地址');
      break;
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
      // Unknown event types: show in verbose, otherwise silently drop.
      // Known-but-not-yet-handled structured events fall here too — log them
      // as a compact hint so users (and us) can see what's being dropped.
      if (opts.verbose) sinks.err(DIM(`[unknown] ${JSON.stringify(ev)}\n`, color));
  }
}
