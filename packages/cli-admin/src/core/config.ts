import fs from 'fs';
import path from 'path';
import os from 'os';
import type { EnvironmentName } from './environments.js';

const CONFIG_DIR = path.join(os.homedir(), '.cashop-console');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Credentials returned by the internal-auth login/refresh flow.
 */
export interface AuthBundle {
  accessToken: string;
  refreshToken: string;
  /** ms epoch when the access token expires. */
  expiresAt: number;
  username?: string;
  /** ms epoch when this bundle was last persisted. */
  savedAt: number;
}

export interface Config {
  env?: EnvironmentName;
  auth?: Partial<Record<EnvironmentName, AuthBundle>>;
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
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const existed = fs.existsSync(CONFIG_FILE);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  if (!existed) {
    try {
      fs.chmodSync(CONFIG_FILE, 0o600);
    } catch {
      // Windows / permission noise — ignore.
    }
  }
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

export function getAuth(env: EnvironmentName): AuthBundle | undefined {
  return readConfig().auth?.[env];
}

export function setAuth(env: EnvironmentName, bundle: AuthBundle): void {
  const config = readConfig();
  const nextAuth = { ...(config.auth ?? {}), [env]: bundle };
  writeConfig({ ...config, auth: nextAuth });
}

export function clearAuth(env: EnvironmentName): void {
  const config = readConfig();
  if (!config.auth?.[env]) return;
  const nextAuth = { ...config.auth };
  delete nextAuth[env];
  writeConfig({ ...config, auth: nextAuth });
}
