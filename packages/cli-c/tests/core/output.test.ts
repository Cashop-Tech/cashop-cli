import { describe, it, expect } from 'vitest';
import { format } from '@cashop/core';

describe('output.format', () => {
  it('json mode returns stringified data', () => {
    const s = format({ a: 1 }, { mode: 'json' });
    expect(JSON.parse(s)).toEqual({ a: 1 });
  });

  it('pretty mode renders table for array-of-objects', () => {
    const s = format([{ id: 1, name: 'x' }, { id: 2, name: 'y' }], { mode: 'pretty' });
    expect(s).toMatch(/id/);
    expect(s).toMatch(/name/);
    expect(s).toMatch(/x/);
  });

  it('pretty mode renders key-value for plain object', () => {
    const s = format({ foo: 'bar', n: 42 }, { mode: 'pretty' });
    expect(s).toContain('foo');
    expect(s).toContain('bar');
  });

  it('pretty mode renders plain string unchanged', () => {
    expect(format('hello', { mode: 'pretty' })).toBe('hello');
  });

  it('pretty mode stringifies nested array-of-objects as JSON (no [object Object])', () => {
    const s = format({ items: [{ id: 1 }, { id: 2 }], total: 42 }, { mode: 'pretty' });
    expect(s).not.toMatch(/\[object Object\]/);
    expect(s).toContain('[{"id":1},{"id":2}]');
    expect(s).toContain('42');
  });

  it('pretty mode stringifies nested object as JSON', () => {
    const s = format({ meta: { a: 1, b: 'x' } }, { mode: 'pretty' });
    expect(s).not.toMatch(/\[object Object\]/);
    expect(s).toContain('{"a":1,"b":"x"}');
  });

  it('pretty mode renders null/undefined cells as empty', () => {
    const s = format({ a: null, b: undefined }, { mode: 'pretty' });
    expect(s).not.toMatch(/null|undefined/);
  });
});
