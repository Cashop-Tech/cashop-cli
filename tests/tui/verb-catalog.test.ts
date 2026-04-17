import { describe, it, expect, beforeAll } from 'vitest';
import type { Command } from 'commander';
import { buildBangShape, renderBangHelp, completeBang } from '../../src/tui/verb-catalog.js';

let shape: Command;
beforeAll(async () => { shape = await buildBangShape(); });

describe('buildBangShape', () => {
  it('registers every verb from loadCommandModules()', () => {
    const names = shape.commands.map(c => c.name());
    for (const expected of ['login', 'search', 'cart', 'pay', 'recommend', 'ask']) {
      expect(names).toContain(expected);
    }
  });

  it('attaches subcommands to group verbs (pay / cart / apikey)', () => {
    // cart group's `.action` is list; `add/count/split` are subs.
    // order group's `.action` takes [orderNo]; `orders` is a sibling top-level verb.
    const paySubs = shape.commands.find(c => c.name() === 'pay')?.commands.map(c => c.name()).sort();
    expect(paySubs).toEqual(['checkout', 'info', 'methods']);
    const cartSubs = shape.commands.find(c => c.name() === 'cart')?.commands.map(c => c.name()).sort();
    expect(cartSubs).toEqual(['add', 'count', 'split']);
    const apikeySubs = shape.commands.find(c => c.name() === 'apikey')?.commands.map(c => c.name()).sort();
    expect(apikeySubs).toEqual(['create', 'list', 'rm']);
  });
});

describe('renderBangHelp', () => {
  it('lists flat verbs on their own line, group verbs with subs joined by " | "', () => {
    const out = renderBangHelp(shape);
    expect(out).toMatch(/^Bang commands/);
    expect(out).toContain('!login');
    expect(out).toContain('!pay');
    expect(out).toMatch(/!pay\s+checkout \| info \| methods/);
    expect(out).toMatch(/!cart\s+add \| count \| split/);
  });
});

describe('completeBang', () => {
  it('returns [[], line] for non-bang input (chat / slash untouched)', () => {
    expect(completeBang('help me', shape)).toEqual([[], 'help me']);
    expect(completeBang('/help', shape)).toEqual([[], '/help']);
    expect(completeBang('', shape)).toEqual([[], '']);
  });

  it('lists all top-level verbs for bare "!"', () => {
    const [hits, sub] = completeBang('!', shape);
    expect(sub).toBe('');
    expect(hits).toContain('login');
    expect(hits).toContain('pay');
    expect(hits).toContain('recommend');
    // sorted
    const sorted = [...hits].sort();
    expect(hits).toEqual(sorted);
  });

  it('prefix-filters top-level verbs', () => {
    const [hits, sub] = completeBang('!pa', shape);
    expect(sub).toBe('pa');
    expect(hits).toEqual(['pay']);
  });

  it('lists subcommands after "!<group> "', () => {
    const [hits, sub] = completeBang('!pay ', shape);
    expect(sub).toBe('');
    expect(hits).toEqual(['checkout', 'info', 'methods']);
  });

  it('prefix-filters subcommands', () => {
    const [hits, sub] = completeBang('!pay c', shape);
    expect(sub).toBe('c');
    expect(hits).toEqual(['checkout']);
  });

  it('returns no subcompletions for flat verbs', () => {
    const [hits] = completeBang('!search ', shape);
    expect(hits).toEqual([]);
  });

  it('returns no completions past the first subcommand level', () => {
    const [hits] = completeBang('!pay checkout --', shape);
    expect(hits).toEqual([]);
  });
});
