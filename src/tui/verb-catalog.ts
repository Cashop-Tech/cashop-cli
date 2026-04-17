import { Command } from 'commander';
import { registerAll, loadCommandModules } from '../commands/index.js';

/**
 * Shape-only bang program for help rendering and Tab completion.
 * No preAction hook, no CliContext, no provider selection — actions never run
 * from this instance. Build once at TUI startup and keep the reference.
 */
export async function buildBangShape(): Promise<Command> {
  const prog = new Command();
  prog.exitOverride();
  registerAll(prog, await loadCommandModules());
  return prog;
}

export function renderBangHelp(prog: Command): string {
  const verbs = [...prog.commands].sort((a, b) => a.name().localeCompare(b.name()));
  const lines = ['Bang commands (runs a shell subcommand; append -h for specifics):'];
  for (const c of verbs) {
    const subs = c.commands.map(sc => sc.name()).sort();
    if (subs.length === 0) {
      lines.push(`  !${c.name()}`);
    } else {
      lines.push(`  !${c.name().padEnd(10)} ${subs.join(' | ')}`);
    }
  }
  return lines.join('\n');
}

/**
 * readline completer: for `!` lines, complete the top-level verb or one level of
 * subcommands. Non-bang lines return [[], line] so chat/slash are untouched.
 */
export function completeBang(line: string, prog: Command): [string[], string] {
  if (!line.startsWith('!')) return [[], line];
  const rest = line.slice(1);
  const lastSpace = rest.lastIndexOf(' ');
  const beforeCurrent = lastSpace >= 0 ? rest.slice(0, lastSpace).trim() : '';
  const current = lastSpace >= 0 ? rest.slice(lastSpace + 1) : rest;

  if (beforeCurrent === '') {
    const hits = prog.commands
      .map(c => c.name())
      .filter(n => n.startsWith(current))
      .sort();
    return [hits, current];
  }

  const parentTokens = beforeCurrent.split(/\s+/);
  if (parentTokens.length === 1) {
    const verb = parentTokens[0];
    const group = prog.commands.find(c => c.name() === verb);
    if (!group || group.commands.length === 0) return [[], current];
    const hits = group.commands
      .map(c => c.name())
      .filter(n => n.startsWith(current))
      .sort();
    return [hits, current];
  }

  return [[], current];
}
