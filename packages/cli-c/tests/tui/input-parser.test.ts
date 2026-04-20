import { describe, it, expect } from 'vitest';
import { parseLine } from '../../src/tui/input-parser.js';

describe('parseLine', () => {
  it('empty line', () => {
    expect(parseLine('')).toEqual({ kind: 'empty' });
    expect(parseLine('   ')).toEqual({ kind: 'empty' });
  });

  it('plain text → chat', () => {
    expect(parseLine('help me find a bag')).toEqual({
      kind: 'chat', text: 'help me find a bag',
    });
  });

  it('bang with quoted arg', () => {
    expect(parseLine('!search "bag pack"')).toEqual({
      kind: 'bang', argv: ['search', 'bag pack'],
    });
  });

  it('bang with flag', () => {
    expect(parseLine('!orders --page-size 3')).toEqual({
      kind: 'bang', argv: ['orders', '--page-size', '3'],
    });
  });

  it('slash with args', () => {
    expect(parseLine('/resume abc123')).toEqual({
      kind: 'slash', name: 'resume', args: ['abc123'],
    });
  });

  it('slash no args', () => {
    expect(parseLine('/sessions')).toEqual({
      kind: 'slash', name: 'sessions', args: [],
    });
  });

  it('treats "!" alone as chat (nothing to run)', () => {
    expect(parseLine('!')).toEqual({ kind: 'chat', text: '!' });
  });
});
