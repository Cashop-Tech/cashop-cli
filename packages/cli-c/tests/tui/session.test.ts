import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadChatState, saveLastSession } from '../../src/tui/session.js';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tui-sess-')); });
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('tui session store', () => {
  it('returns empty object when chat.yaml missing', () => {
    expect(loadChatState(tmp)).toEqual({});
  });

  it('persists and reloads last_session_id', () => {
    saveLastSession(tmp, 'abc123');
    expect(loadChatState(tmp)).toEqual({ last_session_id: 'abc123' });
    expect(existsSync(join(tmp, '.cashop', 'chat.yaml'))).toBe(true);
    expect(readFileSync(join(tmp, '.cashop', 'chat.yaml'), 'utf8'))
      .toContain('last_session_id: abc123');
  });

  it('overwrites on repeated save', () => {
    saveLastSession(tmp, 'first');
    saveLastSession(tmp, 'second');
    expect(loadChatState(tmp)).toEqual({ last_session_id: 'second' });
  });
});
