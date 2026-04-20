import { apiRequest } from '../core/client.js';
import type { ApiContext } from '../core/types.js';

export type { ApiContext } from '../core/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Station {
  id: string;
  usercode: string;
  stationCode: string;
  stationName: string;
}

export interface UserInfo {
  id: string;
  usercode: string;
  username: string;
  realname: string;
  email?: string;
  mobile?: string;
  stationList: Station[];
  currentStation: Station | null;
  roles: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Get current user info including station list and current station.
 */
export async function getUserInfo(ctx: ApiContext): Promise<UserInfo> {
  return apiRequest<UserInfo>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: '/api/v1/login-user/user-info',
    baseUrlType: 'sso',
  });
}

/**
 * Get current station for the logged-in user.
 */
export async function getCurrentStation(ctx: ApiContext): Promise<Station> {
  return apiRequest<Station>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: '/api/v1/login-user/current-station',
    baseUrlType: 'sso',
  });
}

/**
 * Switch the user's current station.
 * Throws if the user does not have permission for the given stationCode.
 */
export async function updateStation(
  ctx: ApiContext,
  stationCode: string,
): Promise<void> {
  // First check if user has permission for this station
  const userInfo = await getUserInfo(ctx);
  const allowed = userInfo.stationList?.map((s) => s.stationCode) ?? [];

  if (!allowed.includes(stationCode)) {
    const available = allowed.join(', ') || '(无)';
    throw new Error(
      `无权访问站点 "${stationCode}"。可用站点：${available}`,
    );
  }

  await apiRequest<unknown>({
    env: ctx.env,
    token: ctx.token,
    method: 'GET',
    url: '/api/v1/login-user/update-station',
    params: { stationCode },
    baseUrlType: 'sso',
  });
}
