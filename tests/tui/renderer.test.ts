import { describe, it, expect } from 'vitest';
import { renderEvent, type RenderSinks } from '../../src/tui/renderer.js';

function makeSinks() {
  const out: string[] = [];
  const err: string[] = [];
  const sinks: RenderSinks = {
    out: (s) => { out.push(s); },
    err: (s) => { err.push(s); },
  };
  return { sinks, out, err };
}

describe('renderEvent', () => {
  it('writes text_delta verbatim to out', () => {
    const { sinks, out } = makeSinks();
    renderEvent({ type: 'text_delta', content: 'hello ' }, sinks, { json: false });
    renderEvent({ type: 'text_delta', content: 'world' }, sinks, { json: false });
    expect(out.join('')).toBe('hello world');
  });

  it('writes typing to err with leading bullet', () => {
    const { sinks, err } = makeSinks();
    renderEvent({ type: 'typing', content: 'searching...' }, sinks, { json: false });
    expect(err.join('')).toMatch(/searching\.\.\./);
    expect(err.join('')).toMatch(/^· |^\u001b\[/); // either plain bullet or colored
  });

  it('writes suggestions as numbered list to out on done', () => {
    const { sinks, out } = makeSinks();
    renderEvent({ type: 'suggestions', questions: ['q1', 'q2'] }, sinks, { json: false });
    expect(out.join('')).toMatch(/\[1\] q1/);
    expect(out.join('')).toMatch(/\[2\] q2/);
  });

  it('writes error to err with prefix', () => {
    const { sinks, err } = makeSinks();
    renderEvent({ type: 'error', message: 'boom' }, sinks, { json: false });
    expect(err.join('')).toMatch(/boom/);
  });

  it('json mode: each event as one JSON line on stdout', () => {
    const { sinks, out, err } = makeSinks();
    renderEvent({ type: 'text_delta', content: 'hi' }, sinks, { json: true });
    renderEvent({ type: 'typing', content: '...' }, sinks, { json: true });
    expect(out.length).toBe(2);
    expect(JSON.parse(out[0])).toEqual({ type: 'text_delta', content: 'hi' });
    expect(JSON.parse(out[1])).toEqual({ type: 'typing', content: '...' });
    expect(err.length).toBe(0);
  });

  it('session_start / done silent in non-verbose', () => {
    const { sinks, out, err } = makeSinks();
    renderEvent({ type: 'session_start', session_id: 'S' }, sinks, { json: false });
    renderEvent({ type: 'done', session_id: 'S' }, sinks, { json: false });
    expect(out.length).toBe(0);
    expect(err.length).toBe(0);
  });

  it('products event renders numbered list with title/price/spu', () => {
    const { sinks, out } = makeSinks();
    renderEvent({
      type: 'products',
      scene: '通勤装',
      one_liner: '推荐三款',
      products: [
        { spuCode: 'SPU1', title: '白衬衫', price: 199, currency: 'CNY' },
        { spuCode: 'SPU2', title: '西裤', price: 299, currency: 'CNY' },
      ],
    }, sinks, { json: false });
    const s = out.join('');
    expect(s).toMatch(/通勤装/);
    expect(s).toMatch(/\[1\] 白衬衫/);
    expect(s).toMatch(/CNY 199/);
    expect(s).toMatch(/spu=SPU1/);
    expect(s).toMatch(/\[2\] 西裤/);
  });

  it('order_card renders each order line', () => {
    const { sinks, out } = makeSinks();
    renderEvent({
      type: 'order_card',
      order: { type: 'order_list', orders: [{ orderNo: 'ORD1', status: 'PAID', amount: 100 }] },
    }, sinks, { json: false });
    const s = out.join('');
    expect(s).toMatch(/ORD1/);
    expect(s).toMatch(/PAID/);
    expect(s).toMatch(/100/);
  });

  it('onboard_options renders numbered list', () => {
    const { sinks, out } = makeSinks();
    renderEvent({
      type: 'onboard_options',
      options: [{ label: '找衣服' }, { label: '看订单' }],
    } as any, sinks, { json: false });
    const s = out.join('');
    expect(s).toMatch(/\[1\] 找衣服/);
    expect(s).toMatch(/\[2\] 看订单/);
  });
});
