#!/usr/bin/env node
import { Command } from 'commander';
import { homedir } from 'node:os';
import { buildContext, type GlobalFlags } from './core/globals.js';
import { exitCodeFor } from './core/errors.js';
import { registerAll } from './commands/index.js';
import { startTui } from './tui/index.js';

async function loadModules() {
  return [
    (await import('./commands/auth/login.js')).default,
    (await import('./commands/auth/logout.js')).default,
    (await import('./commands/auth/whoami.js')).default,
    (await import('./commands/config/config.js')).default,
    (await import('./commands/config/env.js')).default,
    (await import('./commands/product/search.js')).default,
    (await import('./commands/product/get.js')).default,
    (await import('./commands/cart/list.js')).default,
    (await import('./commands/cart/add.js')).default,
    (await import('./commands/order/list.js')).default,
    (await import('./commands/order/get.js')).default,
    (await import('./commands/ask.js')).default,
    (await import('./commands/sessions.js')).default,
    (await import('./commands/session.js')).default,
  ];
}

/**
 * TUI 分支判定：剥离非 positional 的全局 flag 后，若只剩 0 个或只剩一个 `--resume`，走 TUI。
 * 同时把全局 flag 值捕获下来，TUI 分支要把它们喂给 buildContext（否则 --no-color / --json 进 TUI 后失效）。
 * 支持：cashop / cashop --resume / cashop --env stable / cashop --resume --env stable / cashop -y --resume
 */
interface TuiDetect {
  tui: boolean;
  resume: boolean;
  flags: GlobalFlags;
}
function parseEnv(v: string | undefined): 'stable' | 'prod' | undefined {
  return v === 'stable' || v === 'prod' ? v : undefined;
}
function detectTuiMode(rest: string[]): TuiDetect {
  const positional: string[] = [];
  let resume = false;
  const flags: GlobalFlags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === undefined) continue;
    if (a === '--resume') { resume = true; continue; }
    if (a === '--json') { flags.json = true; continue; }
    if (a === '--no-color') { flags.noColor = true; continue; }
    if (a === '--verbose') { flags.verbose = true; continue; }
    if (a === '-y' || a === '--yes') { flags.yes = true; continue; }
    if (a === '--env') { flags.env = parseEnv(rest[++i]); continue; }
    if (a === '--api-key') { flags.apiKey = rest[++i]; continue; }
    if (a.startsWith('--env=')) { flags.env = parseEnv(a.slice('--env='.length)); continue; }
    if (a.startsWith('--api-key=')) { flags.apiKey = a.slice('--api-key='.length); continue; }
    positional.push(a);
  }
  return { tui: positional.length === 0, resume, flags };
}

async function main(argv: string[]): Promise<number> {
  const rest = argv.slice(2);

  // Bare `cashop [--global-flags]` → TUI
  // `cashop --resume [--global-flags]` → TUI, 续最后一个 session
  const tuiDetect = detectTuiMode(rest);
  if (tuiDetect.tui) {
    // spec §3.7：TUI 不支持 --json（输出语义对 chat/slash/bang 混流没意义）。
    // 明确报错而不是静默吞掉，提示用户把 --json 配在具体子命令后。
    if (tuiDetect.flags.json) {
      process.stderr.write('--json is not supported in TUI mode; use e.g. `cashop ask "..." --json` or `cashop sessions --json`.\n');
      return 2;
    }
    const ctx = await buildContext({
      homeDir: homedir(),
      flags: tuiDetect.flags,
      envVars: process.env as Record<string, string | undefined>,
    });
    await startTui(ctx, { resume: tuiDetect.resume });
    return 0;
  }

  const program = new Command();
  program
    .name('cashop-cli')
    .description('Cashop-CLI — official command-line interface for the Cashop platform')
    .version('0.1.0-dev')
    .option('--env <env>', 'override environment (stable|prod)')
    .option('--json', 'machine-readable JSON output')
    .option('--no-color', 'disable colored output')
    .option('--verbose', 'verbose logging to stderr + ~/.cashop/logs/')
    .option('-y, --yes', 'skip confirmation on write ops')
    .option('--api-key <key>', 'use an API key for this invocation only')
    .hook('preAction', async (thisCmd) => {
      const opts = thisCmd.optsWithGlobals();
      const ctx = await buildContext({
        homeDir: homedir(),
        flags: {
          env: opts.env, json: opts.json, noColor: !opts.color,
          verbose: opts.verbose, yes: opts.yes, apiKey: opts.apiKey,
        },
        envVars: process.env as Record<string, string | undefined>,
      });
      (thisCmd as unknown as { __ctx: unknown }).__ctx = ctx;
    });

  registerAll(program, await loadModules());

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return exitCodeFor(err);
  }
}

main(process.argv).then(code => process.exit(code));
