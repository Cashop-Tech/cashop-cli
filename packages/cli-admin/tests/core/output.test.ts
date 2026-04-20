import { describe, it, expect } from 'vitest';
import { formatJson, formatTable } from '../../src/core/output.js';

describe('formatJson', () => {
  it('outputs valid JSON for a plain object', () => {
    const result = formatJson({ a: 1, b: 'hello' });
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ a: 1, b: 'hello' });
  });

  it('pretty-prints with 2-space indentation', () => {
    const result = formatJson({ x: 1 });
    expect(result).toBe(JSON.stringify({ x: 1 }, null, 2));
  });

  it('handles arrays', () => {
    const result = formatJson([1, 2, 3]);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it('handles null', () => {
    const result = formatJson(null);
    expect(result).toBe('null');
  });

  it('handles nested objects', () => {
    const data = { user: { id: 1, name: 'Alice' } };
    const result = formatJson(data);
    expect(JSON.parse(result)).toEqual(data);
  });
});

describe('formatTable', () => {
  it('returns "No results found" when rows array is empty', () => {
    const result = formatTable(['ID', 'Name'], []);
    expect(result).toBe('No results found');
  });

  it('includes the data when rows are provided', () => {
    const result = formatTable(['ID', 'Name'], [['1', 'Alice'], ['2', 'Bob']]);
    // cli-table3 renders box-drawing characters around the data
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('1');
    expect(result).toContain('2');
  });

  it('includes the header columns in the output', () => {
    const result = formatTable(['ID', 'Email'], [['42', 'test@example.com']]);
    expect(result).toContain('ID');
    expect(result).toContain('Email');
  });

  it('appends page info when pageInfo option is provided', () => {
    const result = formatTable(
      ['Col'],
      [['val']],
      { pageInfo: { page: 2, pages: 5, total: 50 } },
    );
    expect(result).toContain('Page 2/5');
    expect(result).toContain('Total: 50');
  });

  it('does not append page info when pageInfo is not provided', () => {
    const result = formatTable(['Col'], [['val']]);
    expect(result).not.toContain('Page');
    expect(result).not.toContain('Total:');
  });

  it('handles a single row with a single column', () => {
    const result = formatTable(['Only'], [['value']]);
    expect(result).toContain('value');
  });
});
