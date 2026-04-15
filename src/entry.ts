#!/usr/bin/env node
import { Command } from 'commander';
import { homedir } from 'node:os';
import { buildContext } from './core/globals.js';
import { exitCodeFor } from './core/errors.js';
import { registerAll } from './commands/index.js';
// command modules — added in later tasks:
// import * as authLogin from './commands/auth/login.js';
// import * as authLogout from './commands/auth/logout.js';
// ...

async function main(argv: string[]): Promise<number> {
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

  const modules: import('./commands/index.js').CommandModule[] = [
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
  registerAll(program, modules);

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return exitCodeFor(err);
  }
}

main(process.argv).then(code => process.exit(code));
