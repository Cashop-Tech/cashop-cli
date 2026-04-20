import type { SlashCtx } from './index.js';

export async function newSlash(_args: string[], ctx: SlashCtx): Promise<void> {
  ctx.state.current_session_id = undefined;
  ctx.out('(new session — will be created on next message)\n');
}
