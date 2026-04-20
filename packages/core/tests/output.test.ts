import { describe, it, expect } from 'vitest';
import { format } from '../src/output.js';

describe('format', () => {
  it('returns JSON string in json mode', () => {
    const out = format({ a: 1 }, { mode: 'json' });
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });

  it('returns raw string as-is in pretty mode', () => {
    expect(format('hello', { mode: 'pretty' })).toBe('hello');
  });

  it('renders array of objects as a table', () => {
    const out = format([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], { mode: 'pretty' });
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).toContain('1');
    expect(out).toContain('y');
  });

  it('stringifies nested objects in cells instead of [object Object]', () => {
    const out = format([{ id: 1, meta: { k: 'v' } }], { mode: 'pretty' });
    expect(out).toContain('"k"');
    expect(out).toContain('"v"');
    expect(out).not.toContain('[object Object]');
  });
});
