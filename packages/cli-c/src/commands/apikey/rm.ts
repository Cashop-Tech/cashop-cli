import type { Command } from 'commander';
import kleur from 'kleur';
import readline from 'node:readline/promises';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { BusinessError, CashopCliError, friendlyBusinessMessage } from '@cashop/core';
import type { ApiKeyListResponse, ApiKeyRevokeRequest, ApiKeyRevokeResponse } from '../../types/api.js';
import { requireOAuthDevice } from './_shared.js';

const LIST_PATH = '/member/cashop-member-auth/api/auth/v1/apikey/list';
const REVOKE_PATH = '/member/cashop-member-auth/api/auth/v1/apikey/revoke';

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name)
    ?? program.command(name).description('Manage API keys');
}

export async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const mod: CommandModule = {
  register(program: Command) {
    const group = ensureGroup(program, 'apikey');

    group
      .command('rm <kid>')
      .description('Revoke an API key by kid (requires device login)')
      .option('-y, --yes', 'skip confirmation prompt')
      .option('--json', 'print JSON instead of human output')
      .action(async function (this: Command, kid: string) {
        const opts = (this as any).opts() as { yes?: boolean; json?: boolean };
        const ctx = getCtx(this as unknown as Command);

        const code = await runCmd(ctx, async () => {
          requireOAuthDevice(ctx.provider);

          if (!opts.yes && !ctx.flags.yes) {
            let prompt = `Revoke API key ${kid}? (y/N) `;
            try {
              const listResp = await gatewayRequest<ApiKeyListResponse>(ctx.baseUrl, LIST_PATH, {
                method: 'GET',
                provider: ctx.provider,
              });
              const hit = listResp.items.find(i => i.kid === kid);
              if (hit) {
                prompt = `Revoke API key "${hit.name}" (${hit.kid})? (y/N) `;
              }
            } catch (e) {
              // Non-fatal: if list lookup fails, fall through to the generic prompt.
              if (e instanceof BusinessError) {
                throw new CashopCliError(friendlyBusinessMessage(e.code, e.message));
              }
              throw e;
            }

            if (!(await confirm(prompt))) {
              process.stdout.write('cancelled.\n');
              return;
            }
          }

          const body: ApiKeyRevokeRequest = { kid };
          let data: ApiKeyRevokeResponse;
          try {
            data = await gatewayRequest<ApiKeyRevokeResponse>(ctx.baseUrl, REVOKE_PATH, {
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
          process.stdout.write(kleur.green(`✓ Revoked ${kid}\n`));
        });
        if (code !== 0) process.exit(code);
      });
  },
};

export default mod;
