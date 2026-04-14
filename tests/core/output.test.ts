import { describe, it, expect } from 'vitest';
import { format } from '../../src/core/output.js';

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
});
