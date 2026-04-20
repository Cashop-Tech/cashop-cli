import readline from 'node:readline/promises';

export interface ConfirmOpts {
  prompt: string;
  yes: boolean;
  autoConfirm?: boolean;
  readLine?: () => Promise<string>;
}

export async function confirmWrite(opts: ConfirmOpts): Promise<boolean> {
  if (opts.yes || opts.autoConfirm) return true;
  const read = opts.readLine ?? (async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    try { return await rl.question(`${opts.prompt} [y/N] `); } finally { rl.close(); }
  });
  const ans = (await read()).trim().toLowerCase();
  return ans === 'y' || ans === 'yes';
}
