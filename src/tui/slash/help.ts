import type { SlashCtx } from './index.js';
import { renderBangHelp } from '../verb-catalog.js';

export async function helpSlash(_args: string[], ctx: SlashCtx): Promise<void> {
  const lines = [
    'Slash commands:',
    '  /help            Show this message',
    '  /new             Start a new chat session',
    '  /sessions        List your chat sessions',
    '  /resume <id>     Switch to a specific session',
    '  /exit            Quit (same as Ctrl-D)',
    '',
    renderBangHelp(ctx.bangProg),
    '',
    'Tab completes !verb and the first subcommand level.',
    '',
  ];
  ctx.out(lines.join('\n'));
}
