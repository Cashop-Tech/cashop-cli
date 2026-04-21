import { requestJson } from '@cashop/core';
import { getEnvironment, type EnvironmentName } from '../core/environments.js';
import { ApiError, AuthenticationError } from '../core/errors.js';

export const AUTH_API_PREFIX = '/basic/cashop-internal-auth/api/v1';

export interface LoginRequest {
  username: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  needSetup?: boolean;
  setupStep?: 'reset_password' | 'bind_totp' | string;
  setupToken?: string;
  needTotp?: boolean;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface MeResponse {
  userId: number | string;
  username: string;
  realName?: string;
  isSuperAdmin?: boolean;
  [key: string]: unknown;
}

interface Envelope<T> {
  code: number;
  message?: string;
  success?: boolean;
  data: T;
}

/**
 * Shape-agnostic envelope unwrap used for the internal-auth endpoints.
 *
 * The new internal-auth API signals success with `code === 0`; legacy gateway
 * APIs still use `code === 200 && success === true`. We accept either.
 */
async function callAuth<T>(
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
  },
): Promise<T> {
  const result = await requestJson<Envelope<T>>(url, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    body: init.body,
  });

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      throw new AuthenticationError('鉴权失败');
    }
    const body = (result.data ?? {}) as Partial<Envelope<unknown>>;
    throw new ApiError(
      result.status,
      body.message ?? `HTTP ${result.status}`,
      body.code !== undefined ? String(body.code) : undefined,
    );
  }

  const envelope = result.data;
  if (!envelope) {
    throw new ApiError(result.status, 'Empty response body');
  }

  const isSuccess =
    envelope.code === 0 || envelope.code === 200 || envelope.success === true;
  if (!isSuccess) {
    if (envelope.code === 40103 || envelope.code === 4003 || envelope.code === 403) {
      throw new AuthenticationError(envelope.message ?? '鉴权失败');
    }
    throw new ApiError(
      result.status,
      envelope.message ?? 'Request failed',
      String(envelope.code),
    );
  }

  return envelope.data;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Login / Refresh / Me / Logout
// ---------------------------------------------------------------------------

export async function login(
  env: EnvironmentName,
  body: LoginRequest,
): Promise<LoginResponse> {
  const base = getEnvironment(env).apiUrl;
  return callAuth<LoginResponse>(`${base}${AUTH_API_PREFIX}/login`, {
    method: 'POST',
    body,
  });
}

export async function refreshAccessToken(
  env: EnvironmentName,
  refreshToken: string,
): Promise<LoginResponse> {
  const base = getEnvironment(env).apiUrl;
  return callAuth<LoginResponse>(`${base}${AUTH_API_PREFIX}/token/refresh`, {
    method: 'POST',
    body: { refreshToken } satisfies RefreshRequest,
  });
}

export async function getMe(
  env: EnvironmentName,
  accessToken: string,
): Promise<MeResponse> {
  const base = getEnvironment(env).apiUrl;
  return callAuth<MeResponse>(`${base}${AUTH_API_PREFIX}/me`, {
    method: 'GET',
    headers: bearer(accessToken),
  });
}

export async function logout(
  env: EnvironmentName,
  accessToken: string,
): Promise<void> {
  const base = getEnvironment(env).apiUrl;
  await callAuth<void>(`${base}${AUTH_API_PREFIX}/logout`, {
    method: 'POST',
    headers: bearer(accessToken),
  });
}
