import { gatewayRequest } from '../http-client.js';
import type { Env, TokenStore } from '../token-store.js';
import { CashopCliError, BusinessError } from '@cashop/core';
import { openBrowser } from './open-browser.js';

const DEVICE_PATH = '/member/cashop-member-auth/open/auth/v1/device';
const POLL_PATH = '/member/cashop-member-auth/open/auth/v1/device/poll';

interface DeviceResp {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

interface TokenResp {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  userId: number | string;
  scope: string;
}

export interface DeviceFlowInput {
  base: string;
  env: Env;
  store: TokenStore;
  noBrowser: boolean;
  printer: (line: string) => void;
  nowProvider?: () => number;
  sleeper?: (ms: number) => Promise<void>;
  maxPolls?: number;
}

export async function runDeviceFlow(input: DeviceFlowInput): Promise<{ userId: string }> {
  const now = input.nowProvider ?? Date.now;
  const sleep = input.sleeper ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  const device = await gatewayRequest<DeviceResp>(input.base, DEVICE_PATH, {
    method: 'POST',
    body: { clientId: 'cli', scope: 'cli' },
  });

  const open = await openBrowser(device.verificationUriComplete, {
    noBrowser: input.noBrowser,
    env: process.env,
    platform: process.platform,
  });
  if (open.opened) {
    input.printer(`Please approve on the opened page. Code: ${device.userCode}`);
  } else {
    input.printer(`Open this URL in a browser: ${device.verificationUriComplete}`);
    input.printer(`Code: ${device.userCode}`);
  }

  const startedAt = now();
  const hardDeadline = startedAt + device.expiresIn * 1000;
  let interval = device.interval;
  const cap = input.maxPolls ?? Number.POSITIVE_INFINITY;

  for (let i = 0; i < cap; i++) {
    if (now() >= hardDeadline) {
      throw new CashopCliError('Authorization expired. Try again: cashop login --device');
    }
    await sleep(interval * 1000);
    try {
      const tok = await gatewayRequest<TokenResp>(input.base, POLL_PATH, {
        method: 'POST',
        body: { deviceCode: device.deviceCode },
      });
      await input.store.saveOAuth(input.env, {
        access_token: tok.accessToken,
        refresh_token: tok.refreshToken,
        expires_at: now() + tok.expiresIn * 1000,
        refresh_expires_at: now() + tok.refreshExpiresIn * 1000,
        account: String(tok.userId),
        scopes: [tok.scope],
      });
      return { userId: String(tok.userId) };
    } catch (e) {
      if (!(e instanceof BusinessError)) throw e;
      if (e.code === '703001') continue;
      if (e.code === '703002') { interval = Math.min(interval * 2, 30); continue; }
      if (e.code === '703004') throw new CashopCliError('Authorization denied by user.');
      if (e.code === '703003') throw new CashopCliError('Authorization expired. Try again: cashop login --device');
      throw e;
    }
  }
  throw new CashopCliError('Authorization expired. Try again: cashop login --device');
}
