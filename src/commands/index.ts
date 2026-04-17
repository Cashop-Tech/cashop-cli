import type { Command } from 'commander';

export interface CommandModule {
  register(program: Command): void;
}

export function registerAll(program: Command, mods: CommandModule[]): void {
  for (const m of mods) m.register(program);
}

// Single source of truth for command registration, shared by entry.ts (argv mode)
// and tui/index.ts::buildBangProgram (TUI bang mode). Keep list in sync by editing
// here only.
export async function loadCommandModules(): Promise<CommandModule[]> {
  return [
    (await import('./auth/login.js')).default,
    (await import('./auth/logout.js')).default,
    (await import('./auth/whoami.js')).default,
    (await import('./config/config.js')).default,
    (await import('./config/env.js')).default,
    (await import('./product/search.js')).default,
    (await import('./product/get.js')).default,
    (await import('./cart/list.js')).default,
    (await import('./cart/add.js')).default,
    (await import('./cart/split.js')).default,
    (await import('./cart/count.js')).default,
    (await import('./order/list.js')).default,
    (await import('./order/get.js')).default,
    (await import('./order/create.js')).default,
    (await import('./order/cancel.js')).default,
    (await import('./order/address.js')).default,
    (await import('./address/list.js')).default,
    (await import('./address/save.js')).default,
    (await import('./refund/apply.js')).default,
    (await import('./track.js')).default,
    (await import('./shipping/compare.js')).default,
    (await import('./size.js')).default,
    (await import('./promo.js')).default,
    (await import('./coupon/claim.js')).default,
    (await import('./pay.js')).default,
    (await import('./pay-methods.js')).default,
    (await import('./pay-checkout.js')).default,
    (await import('./pay-info.js')).default,
    (await import('./recommend.js')).default,
    (await import('./checkout/fee.js')).default,
    (await import('./checkout/split.js')).default,
    (await import('./apikey/create.js')).default,
    (await import('./apikey/list.js')).default,
    (await import('./apikey/rm.js')).default,
    (await import('./ask.js')).default,
    (await import('./sessions.js')).default,
    (await import('./session.js')).default,
  ];
}
