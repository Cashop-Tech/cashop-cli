import type { AuthProvider } from './index.js';
import type { Env, TokenStore } from '../token-store.js';
import { gatewayRequest } from '../http-client.js';

const LOGIN_PATH = '/member/cashop-member-auth/open/auth/v1/login';

interface LoginData {
  nickname?: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  expireTime: string;         // ISO
  refreshExpireTime: string;  // ISO
  loginType: string;
  channel: string;
}

export class PasswordProvider implements AuthProvider {
  kind = 'password' as const;
  constructor(private store: TokenStore, private env: Env) {}

  async getAccessToken(): Promise<string | null> {
    const t = await this.store.getPasswordToken(this.env);
    return t?.accessToken ?? null;
  }
  async refresh() { throw new Error('password tokens do not refresh; re-login required'); }
  async clear() { await this.store.clearPasswordToken(this.env); }

  static async login(input: {
    base: string; env: Env; store: TokenStore;
    email: string; password: string; deviceId: string;
  }): Promise<{ userId: string; nickname?: string }> {
    const data = await gatewayRequest<LoginData>(input.base, LOGIN_PATH, {
      method: 'POST',
      headers: { 'login-channel': 'app', 'device-id': input.deviceId },
      body: { email: input.email, password: input.password, loginType: 'emailPassword', channel: 'app' },
    });
    await input.store.savePasswordToken(input.env, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expires_at: Date.parse(data.expireTime),
      refresh_expires_at: Date.parse(data.refreshExpireTime),
      userId: data.userId,
      nickname: data.nickname,
      email: input.email,
    });
    return { userId: data.userId, nickname: data.nickname };
  }
}
