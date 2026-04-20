import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import YAML from 'yaml';

export interface ChatState {
  last_session_id?: string;
}

export function chatStatePath(homeDir: string): string {
  return join(homeDir, '.cashop', 'chat.yaml');
}

export function loadChatState(homeDir: string): ChatState {
  const p = chatStatePath(homeDir);
  if (!existsSync(p)) return {};
  try {
    const parsed = YAML.parse(readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function saveLastSession(homeDir: string, sessionId: string): void {
  const p = chatStatePath(homeDir);
  mkdirSync(dirname(p), { recursive: true });
  const cur = loadChatState(homeDir);
  cur.last_session_id = sessionId;
  writeFileSync(p, YAML.stringify(cur));
}
