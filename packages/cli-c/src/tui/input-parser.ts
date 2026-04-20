import { parse as shellParse } from 'shell-quote';

export type Parsed =
  | { kind: 'empty' }
  | { kind: 'chat'; text: string }
  | { kind: 'bang'; argv: string[] }
  | { kind: 'slash'; name: string; args: string[] };

export function parseLine(raw: string): Parsed {
  const line = raw.trimEnd();
  if (!line.trim()) return { kind: 'empty' };

  if (line.startsWith('!')) {
    const rest = line.slice(1).trim();
    if (!rest) return { kind: 'chat', text: '!' };
    const argv = shellParse(rest).filter((t): t is string => typeof t === 'string');
    return { kind: 'bang', argv };
  }
  if (line.startsWith('/')) {
    const rest = line.slice(1).trim();
    const [name, ...args] = rest.split(/\s+/);
    return { kind: 'slash', name: name ?? '', args };
  }
  return { kind: 'chat', text: line };
}
