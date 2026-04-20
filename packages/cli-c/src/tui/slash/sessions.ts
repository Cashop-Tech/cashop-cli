import Table from 'cli-table3';
import type { SlashCtx } from './index.js';

export async function sessionsSlash(_args: string[], ctx: SlashCtx): Promise<void> {
  try {
    const res = await ctx.listSessions();
    const t = new Table({ head: ['id', 'title', 'updated_at'] });
    for (const s of res.sessions) {
      t.push([s.session_id, s.title ?? '-', s.updated_at ?? '-']);
    }
    ctx.out(t.toString() + '\n');
  } catch (e) {
    ctx.err(`failed to list sessions: ${e instanceof Error ? e.message : String(e)}\n`);
  }
}
