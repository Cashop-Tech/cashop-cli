import type { SlashCtx } from './index.js';

export async function helpSlash(_args: string[], ctx: SlashCtx): Promise<void> {
  ctx.out([
    'Slash commands:',
    '  /help            Show this message',
    '  /new             Start a new chat session',
    '  /sessions        List your chat sessions',
    '  /resume <id>     Switch to a specific session',
    '  /exit            Quit (same as Ctrl-D)',
    '',
    'Bang commands (runs a shell subcommand):',
    '  !login / !logout / !whoami',
    '  !search <kw> / !product <spu>',
    '  !cart / !cart add / !orders / !order <no>',
    '',
  ].join('\n'));
}
