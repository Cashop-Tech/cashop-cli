import type { SessionListResponse } from '../../types/chat.js';
import { helpSlash } from './help.js';
import { newSlash } from './new.js';
import { sessionsSlash } from './sessions.js';
import { resumeSlash } from './resume.js';
import { exitSlash } from './exit.js';

export interface TuiState {
  current_session_id?: string;
  needs_relogin?: boolean;   // set when server emits session_expired / 401；下一条 chat 前拦截
}

export interface SlashCtx {
  out: (s: string) => void;
  err: (s: string) => void;
  state: TuiState;
  listSessions: () => Promise<SessionListResponse>;
  exit: () => void;
}

const REGISTRY: Record<string, (args: string[], ctx: SlashCtx) => Promise<void>> = {
  help: helpSlash,
  new: newSlash,
  sessions: sessionsSlash,
  resume: resumeSlash,
  exit: exitSlash,
};

export async function dispatchSlash(name: string, args: string[], ctx: SlashCtx): Promise<void> {
  const fn = REGISTRY[name];
  if (!fn) { ctx.err(`unknown slash command: /${name} — try /help\n`); return; }
  await fn(args, ctx);
}

export { helpSlash, newSlash, sessionsSlash, resumeSlash, exitSlash };
