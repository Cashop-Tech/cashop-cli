import type { Env, TokenStore } from '../token-store.js';
import { PasswordProvider } from './password.js';

export interface AuthProvider {
  kind: 'password' | 'oauth' | 'api-key' | 'none';
  getAccessToken(): Promise<string | null>;
  refresh(): Promise<void>;
  clear(): Promise<void>;
}

export const NoProvider: AuthProvider = {
  kind: 'none',
  async getAccessToken() { return null; },
  async refresh() {},
  async clear() {},
};

export class ApiKeyProvider implements AuthProvider {
  kind = 'api-key' as const;
  constructor(private key: string) {}
  async getAccessToken() { return this.key; }
  async refresh() {}
  async clear() {}
}

export interface SelectInput {
  env: Env;
  store: TokenStore;
  flags: { apiKey?: string };
  envVars: Record<string, string | undefined>;
}

export async function selectProvider(input: SelectInput): Promise<AuthProvider> {
  if (input.flags.apiKey) return new ApiKeyProvider(input.flags.apiKey);
  if (input.envVars.CASHOP_API_KEY) return new ApiKeyProvider(input.envVars.CASHOP_API_KEY);
  const apiKey = await input.store.getApiKey(input.env);
  if (apiKey) return new ApiKeyProvider(apiKey.key);
  const password = await input.store.getPasswordToken(input.env);
  if (password) return new PasswordProvider(input.store, input.env);
  return NoProvider;
}
