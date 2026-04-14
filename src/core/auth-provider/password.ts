import type { AuthProvider } from './index.js';
import type { Env, TokenStore } from '../token-store.js';

export class PasswordProvider implements AuthProvider {
  kind = 'password' as const;
  constructor(private store: TokenStore, private env: Env) {}
  async getAccessToken(): Promise<string | null> {
    const t = await this.store.getPasswordToken(this.env);
    return t?.accessToken ?? null;
  }
  async refresh() { throw new Error('password tokens do not refresh; re-login required'); }
  async clear() { await this.store.clearPasswordToken(this.env); }
}
