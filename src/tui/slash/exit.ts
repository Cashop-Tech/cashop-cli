import type { SlashCtx } from './index.js';

export async function exitSlash(_args: string[], ctx: SlashCtx): Promise<void> {
  ctx.exit();
}
