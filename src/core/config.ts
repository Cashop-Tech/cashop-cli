import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';

const ConfigSchema = z.object({
  env: z.enum(['stable', 'prod']).default('stable'),
  output: z.enum(['pretty', 'json']).default('pretty'),
  color: z.enum(['auto', 'always', 'never']).default('auto'),
  auto_confirm: z.boolean().default(false),
  telemetry: z.boolean().default(false),
  editor: z.string().default('vim'),
  install_method: z.enum(['install.sh', 'brew', 'npm', 'dev']).default('dev'),
  api: z.object({
    stable: z.string().url().default('http://159.138.7.47'),
    prod: z.string().url().nullable().default(null),
  }).default({ stable: 'http://159.138.7.47', prod: null }),
  device_id: z.string().nullable().default(null),
  aliases: z.record(z.string()).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export const defaultConfig: Config = ConfigSchema.parse({});

export function loadConfig(path: string): Config {
  if (!existsSync(path)) return defaultConfig;
  const raw = readFileSync(path, 'utf8');
  const parsed = parse(raw) ?? {};
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid config at ${path}: ${issue?.path.join('.')} — ${issue?.message}`);
  }
  return result.data;
}

export function saveConfig(path: string, cfg: Config): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringify(cfg), { mode: 0o600 });
}

export function getField(cfg: Config, key: string): unknown {
  return key.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), cfg);
}

export function setField(cfg: Config, key: string, value: string): Config {
  const parts = key.split('.');
  const out = structuredClone(cfg);
  let node: any = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (node[p] == null || typeof node[p] !== 'object') node[p] = {};
    node = node[p];
  }
  const leaf = parts[parts.length - 1]!;
  node[leaf] = coerce(value);
  return out;
}

function coerce(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}
