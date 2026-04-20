import type { Command } from 'commander';
import kleur from 'kleur';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { BusinessError, CashopCliError, friendlyBusinessMessage } from '@cashop/core';
import type { ApiKeyCreateRequest, ApiKeyCreateResponse, ApiKeyTtl } from '../../types/api.js';
import { requireOAuthDevice, formatIsoUtc } from './_shared.js';

const CREATE_PATH = '/member/cashop-member-auth/api/auth/v1/apikey/create';

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name)
    ?? program.command(name).description('Manage API keys');
}

const mod: CommandModule = {
  register(program: Command) {
    const group = ensureGroup(program, 'apikey');

    group
      .command('create')
      .description('Create a new API key (requires device login)')
      .requiredOption('--name <name>', 'human-readable label, [A-Za-z0-9_\\-\\s]{1,50}')
      .option('--ttl <ttl>', 'one of 30d | 90d | 1y | never', '90d')
      .option('--json', 'print JSON instead of human output')
      .action(async function (this: Command) {
        const opts = (this as any).opts() as { name: string; ttl: string; json?: boolean };
        const ctx = getCtx(this as unknown as Command);

        const code = await runCmd(ctx, async () => {
          requireOAuthDevice(ctx.provider);
          const body: ApiKeyCreateRequest = {
            name: opts.name,
            ttl: opts.ttl as ApiKeyTtl,
          };
          let data: ApiKeyCreateResponse;
          try {
            data = await gatewayRequest<ApiKeyCreateResponse>(ctx.baseUrl, CREATE_PATH, {
              method: 'POST',
              provider: ctx.provider,
              body,
            });
          } catch (e) {
            if (e instanceof BusinessError) {
              throw new CashopCliError(friendlyBusinessMessage(e.code, e.message));
            }
            throw e;
          }

          if (opts.json || ctx.outputMode === 'json') {
            process.stdout.write(JSON.stringify(data) + '\n');
            return;
          }
          process.stdout.write(kleur.green(`✓ Created API key "${data.name}"\n`));
          process.stdout.write(`  kid:     ${data.kid}\n`);
          process.stdout.write(`  expires: ${formatIsoUtc(data.expiresAt)}\n\n`);
          process.stdout.write(`  ${kleur.bold(data.key)}\n\n`);
          process.stdout.write(kleur.yellow('  ↑ only shown once. Save it now (CI secret, 1Password, env var).\n'));
        });
        if (code !== 0) process.exit(code);
      });
  },
};

export default mod;
