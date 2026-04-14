import type { Command } from 'commander';

export interface CommandModule {
  register(program: Command): void;
}

export function registerAll(program: Command, mods: CommandModule[]): void {
  for (const m of mods) m.register(program);
}
