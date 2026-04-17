import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { AddressSaveData, AddressSaveRequest } from '../../types/api.js';

const SAVE_PATH = '/business/cashop-business-aggr-prod/api/member/address/save';

const mod: CommandModule = {
  register(program: Command) {
    const address = ensureGroup(program, 'address');
    address.command('save')
      .description('Create a delivery address (default), or update one by passing --address-id')
      .requiredOption('--first-name <name>', 'receiver first name')
      .requiredOption('--last-name <name>', 'receiver last name')
      .requiredOption('--phone <phone>', 'receiver phone (no area code)')
      .requiredOption('--area-code <code>', 'phone area code (e.g. +81)')
      .requiredOption('--country <code>', 'country code (JP | US | HK); also drives x-country header')
      .requiredOption('--province <name>', 'province / prefecture')
      .requiredOption('--city <name>', 'city / ward')
      .requiredOption('--detail <address>', 'street / building details')
      .requiredOption('--postal-code <code>', 'postal code')
      .option('--address-id <id>', 'address id (set to update an existing address; omit to create)')
      .option('--default', 'mark this address as default', false)
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as {
          opts(): Record<string, string | boolean | undefined>;
        }).opts();
        const country = String(opts.country);
        const body: AddressSaveRequest = {
          receiverFirstName: String(opts.firstName),
          receiverLastName: String(opts.lastName),
          receiverPhone: String(opts.phone),
          phoneAreaCode: String(opts.areaCode),
          country,
          province: String(opts.province),
          city: String(opts.city),
          detailAddress: String(opts.detail),
          postalCode: String(opts.postalCode),
          isDefault: opts.default === true,
        };
        if (opts.addressId) body.addressId = String(opts.addressId);
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<AddressSaveData>(ctx.baseUrl, SAVE_PATH, {
            method: 'POST', provider: ctx.provider, body,
            headers: {
              'x-country': country,
              'x-currency': String(opts.currency),
              'x-language': String(opts.language),
            },
          }));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
