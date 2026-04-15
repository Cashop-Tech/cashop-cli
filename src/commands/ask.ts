import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx } from './_helpers.js';
import { streamChat } from '../core/sse-client.js';
import { renderEvent } from '../tui/renderer.js';
import { loadChatState, saveLastSession } from '../tui/session.js';
import { NetworkError, BusinessError } from '../core/errors.js';

const mod: CommandModule = {
  register(program: Command) {
    program.command('ask <message...>')
      .description('One-shot chat: send a message and stream the reply')
      .option('--resume', 'continue last session')
      .option('--session <id>', 'specify a session id')
      .action(async function (this: Command, messageParts: string[]) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as any).opts();
        const message = messageParts.join(' ');
        let sessionId: string | undefined = opts.session;
        if (!sessionId && opts.resume) {
          sessionId = loadChatState(ctx.homeDir).last_session_id;
        }
        const token = await ctx.provider.getAccessToken?.();
        if (!token) { process.stderr.write('not logged in\n'); process.exit(4); }

        const sinks = {
          out: (s: string) => process.stdout.write(s),
          err: (s: string) => process.stderr.write(s),
        };
        const json = ctx.outputMode === 'json';
        const color = !ctx.flags.noColor && process.stdout.isTTY !== false;

        try {
          let lastError = false;
          for await (const ev of streamChat({
            base: ctx.baseUrl, token,
            body: { message, session_id: sessionId },
          })) {
            if (ev.type === 'session_start' && ev.session_id) {
              saveLastSession(ctx.homeDir, ev.session_id);
            }
            if (ev.type === 'error') lastError = true;
            renderEvent(ev, sinks, { json, color });
          }
          if (!json) process.stdout.write('\n');
          if (lastError) process.exit(1);
        } catch (e) {
          process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
          if (e instanceof NetworkError) process.exit(3);
          if (e instanceof BusinessError) process.exit(1);
          process.exit(1);
        }
      });
  },
};
export default mod;
