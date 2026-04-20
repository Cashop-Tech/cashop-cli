import fs from 'fs';
import path from 'path';
import os from 'os';
import type { EnvironmentName } from './environments.js';

const CONFIG_DIR = path.join(os.homedir(), '.cashop-console');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface Config {
  env?: EnvironmentName;
  tokens?: Partial<Record<EnvironmentName, string>>;
  defaultSite?: string;
}

export function readConfig(): Config {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigValue(key: string): string | undefined {
  const config = readConfig() as Record<string, unknown>;
  const value = config[key];
  return typeof value === 'string' ? value : undefined;
}

export function setConfigValue(key: string, value: string): void {
  const config = readConfig() as Record<string, unknown>;
  config[key] = value;
  writeConfig(config as Config);
}

export function getToken(env: EnvironmentName): string | undefined {
  const config = readConfig();
  return config.tokens?.[env];
}

export function setToken(env: EnvironmentName, token: string): void {
  const config = readConfig();
  config.tokens = config.tokens ?? {};
  config.tokens[env] = token;
  writeConfig(config);
}

export function clearToken(env: EnvironmentName): void {
  const config = readConfig();
  if (config.tokens) {
    delete config.tokens[env];
  }
  writeConfig(config);
}
