import type { SlashCtx } from './index.js';

export async function resumeSlash(args: string[], ctx: SlashCtx): Promise<void> {
  const id = args[0];
  if (!id) { ctx.err('usage: /resume <session-id>\n'); return; }
  ctx.state.current_session_id = id;
  ctx.out(`(resumed session ${id})\n`);
}
