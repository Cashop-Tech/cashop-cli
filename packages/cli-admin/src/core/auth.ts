import { readConfig, getToken } from './config.js';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from './environments.js';
import { AuthenticationError } from './errors.js';

export interface AuthContext {
  token: string;
  env: EnvironmentName;
}

/**
 * Resolve a token using priority order:
 * 1. options.token (CLI flag)
 * 2. CASHOP_TOKEN environment variable
 * 3. Token stored in config file for the resolved environment
 */
export function resolveToken(options: { token?: string; env?: EnvironmentName }): string {
  if (options.token) return options.token;
  if (process.env['CASHOP_TOKEN']) return process.env['CASHOP_TOKEN'];

  const config = readConfig();
  const env: EnvironmentName =
    options.env ?? (config.env as EnvironmentName | undefined) ?? DEFAULT_ENVIRONMENT;
  const token = getToken(env);
  if (!token) throw new AuthenticationError();
  return token;
}

export function resolveAuthContext(options: {
  token?: string;
  env?: EnvironmentName;
}): AuthContext {
  const config = readConfig();
  const env: EnvironmentName =
    options.env ?? (config.env as EnvironmentName | undefined) ?? DEFAULT_ENVIRONMENT;
  const token = resolveToken({ ...options, env });
  return { token, env };
}
