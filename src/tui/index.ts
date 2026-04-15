import { createInterface } from 'node:readline';
import { Command } from 'commander';
import type { CliContext } from '../core/globals.js';
import { parseLine } from './input-parser.js';
import { dispatchSlash, type SlashCtx, type TuiState } from './slash/index.js';
import { runBang } from './bang.js';
import { renderEvent } from './renderer.js';
import { streamChat } from '../core/sse-client.js';
import { loadChatState, saveLastSession } from './session.js';
import { gatewayRequest } from '../core/http-client.js';
import type { SessionListResponse } from '../types/chat.js';
import { registerAll } from '../commands/index.js';

export interface StartTuiOpts {
  resume?: boolean;
}

async function buildBangProgram(ctx: CliContext): Promise<Command> {
  const prog = new Command();
  prog.exitOverride();
  // 1) 声明 P1 entry.ts 的同套全局 flag，避免 `!search bag --json` 被判为 unknown option
  prog
    .option('--env <env>', 'override environment (stable|prod)')
    .option('--json', 'machine-readable JSON output')
    .option('--no-color', 'disable colored output')
    .option('--verbose', 'verbose logging to stderr + ~/.cashop/logs/')
    .option('-y, --yes', 'skip confirmation on write ops')
    .option('--api-key <key>', 'use an API key for this invocation only');
  // 2) preAction hook 合并外层 ctx + 本次 bang 指定的 flags，写回 __ctx
  //    外层 TUI 启动时的 ctx.flags 为 base；bang 这一行用户显式带的 -y/--json/... 覆盖它
  prog.hook('preAction', (thisCmd) => {
    const opts = thisCmd.optsWithGlobals();
    const mergedFlags = {
      ...ctx.flags,
      env: opts.env ?? ctx.flags.env,
      json: opts.json ?? ctx.flags.json,
      noColor: opts.color === false ? true : ctx.flags.noColor,
      verbose: opts.verbose ?? ctx.flags.verbose,
      yes: opts.yes ?? ctx.flags.yes,
      apiKey: opts.apiKey ?? ctx.flags.apiKey,
    };
    const bangCtx: CliContext = {
      ...ctx,
      flags: mergedFlags,
      outputMode: mergedFlags.json ? 'json' : ctx.outputMode,
    };
    (thisCmd as any).__ctx = bangCtx;
  });
  // Dynamically register the same modules as entry.ts
  const modules = [
    (await import('../commands/auth/login.js')).default,
    (await import('../commands/auth/logout.js')).default,
    (await import('../commands/auth/whoami.js')).default,
    (await import('../commands/config/config.js')).default,
    (await import('../commands/config/env.js')).default,
    (await import('../commands/product/search.js')).default,
    (await import('../commands/product/get.js')).default,
    (await import('../commands/cart/list.js')).default,
    (await import('../commands/cart/add.js')).default,
    (await import('../commands/order/list.js')).default,
    (await import('../commands/order/get.js')).default,
    (await import('../commands/sessions.js')).default,
    (await import('../commands/session.js')).default,
  ];
  registerAll(prog, modules);
  return prog;
}

export async function startTui(ctx: CliContext, opts: StartTuiOpts = {}): Promise<void> {
  const state: TuiState = {};
  if (opts.resume) {
    state.current_session_id = loadChatState(ctx.homeDir).last_session_id;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  let exiting = false;

  process.stdout.write([
    `cashop-cli (${ctx.env})`,
    `Type a message to chat. !cmd runs a shell subcommand. /help for slash commands.`,
    `(Ctrl-D or /exit to quit)`,
    '',
  ].join('\n') + '\n');

  rl.prompt();

  rl.on('line', async (line) => {
    const parsed = parseLine(line);
    try {
      if (parsed.kind === 'empty') { /* noop */ }
      else if (parsed.kind === 'slash') {
        const slashCtx: SlashCtx = {
          out: (s) => process.stdout.write(s),
          err: (s) => process.stderr.write(s),
          state,
          listSessions: async () => gatewayRequest<SessionListResponse>(
            ctx.baseUrl, '/ai/cashop-ai/rpc/auth/sessions',
            { method: 'GET', provider: ctx.provider },
          ),
          exit: () => { exiting = true; rl.close(); },
        };
        await dispatchSlash(parsed.name, parsed.args, slashCtx);
      }
      else if (parsed.kind === 'bang') {
        const program = await buildBangProgram(ctx);
        const code = await runBang(program, parsed.argv, {
          out: (s) => process.stdout.write(s),
          err: (s) => process.stderr.write(s),
        });
        // 仅登录成功（exit code 0）才清掉 re-login 拦截，避免密码错还解除
        if (parsed.argv[0] === 'login' && code === 0 && state.needs_relogin) {
          state.needs_relogin = false;
        }
      }
      else if (parsed.kind === 'chat') {
        if (state.needs_relogin) {
          process.stderr.write('session expired — run !login to continue\n');
          rl.prompt(); return;
        }
        const token = await ctx.provider.getAccessToken?.();
        if (!token) { process.stderr.write('not logged in — run !login first\n'); rl.prompt(); return; }
        const sinks = {
          out: (s: string) => process.stdout.write(s),
          err: (s: string) => process.stderr.write(s),
        };
        try {
          for await (const ev of streamChat({
            base: ctx.baseUrl, token,
            body: { message: parsed.text, session_id: state.current_session_id },
          })) {
            if (ev.type === 'session_start' && ev.session_id) {
              state.current_session_id = ev.session_id;
              saveLastSession(ctx.homeDir, ev.session_id);
            }
            if (ev.type === 'session_expired') {
              state.needs_relogin = true;
              state.current_session_id = undefined;
            }
            renderEvent(ev, sinks, {
              json: false,
              color: !ctx.flags.noColor && process.stdout.isTTY !== false,
            });
          }
          process.stdout.write('\n');
        } catch (e) {
          process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
        }
      }
    } finally {
      if (!exiting) rl.prompt();
    }
  });

  rl.on('close', () => {
    process.stdout.write('\nbye.\n');
  });

  return new Promise<void>((resolve) => rl.once('close', () => resolve()));
}
