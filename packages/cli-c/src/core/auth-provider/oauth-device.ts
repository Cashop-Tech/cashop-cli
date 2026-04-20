import type { AuthProvider } from './index.js';
import type { Env, TokenStore } from '../token-store.js';
import { gatewayRequest } from '../http-client.js';
import { BusinessError, ReauthRequired } from '@cashop/core';

const REFRESH_PATH = '/member/cashop-member-auth/open/auth/v1/device/refresh';

interface RefreshResp {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  userId: number | string;
  scope: string;
}

export class OAuthDeviceProvider implements AuthProvider {
  kind = 'oauth-device' as const;
  constructor(private base: string, private env: Env, private store: TokenStore) {}

  async getAccessToken(): Promise<string | null> {
    const t = await this.store.getOAuth(this.env);
    return t?.access_token ?? null;
  }

  async refresh(): Promise<void> {
    const cur = await this.store.getOAuth(this.env);
    if (!cur) throw new ReauthRequired();
    if (Date.now() >= cur.refresh_expires_at) {
      await this.store.clearOAuth(this.env);
      throw new ReauthRequired();
    }
    try {
      const resp = await gatewayRequest<RefreshResp>(this.base, REFRESH_PATH, {
        method: 'POST',
        body: { refreshToken: cur.refresh_token },
      });
      await this.store.saveOAuth(this.env, {
        access_token: resp.accessToken,
        refresh_token: resp.refreshToken,
        expires_at: Date.now() + resp.expiresIn * 1000,
        refresh_expires_at: Date.now() + resp.refreshExpiresIn * 1000,
        account: String(resp.userId),
        scopes: [resp.scope],
      });
    } catch (e) {
      if (e instanceof BusinessError) {
        if (e.code === '703011') {
          await this.store.clearOAuth(this.env);
          const err = new ReauthRequired();
          err.message = 'Session revoked (token reuse detected). Please re-login: cashop login --device';
          throw err;
        }
        if (e.code === '703005') {
          await this.store.clearOAuth(this.env);
          const err = new ReauthRequired();
          err.message = 'Session expired. Please re-login: cashop login --device';
          throw err;
        }
      }
      throw e;
    }
  }

  async clear(): Promise<void> {
    await this.store.clearOAuth(this.env);
  }
}
