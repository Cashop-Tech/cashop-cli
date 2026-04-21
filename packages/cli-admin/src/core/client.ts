import { requestJson, type HttpMethod } from '@cashop/core';
import { refreshAccessToken } from '../api/internal-auth.js';
import { getAuth, setAuth, clearAuth, type AuthBundle } from './config.js';
import { getEnvironment, type EnvironmentName } from './environments.js';
import { ApiError, AuthenticationError } from './errors.js';
import type { ApiResponse } from './types.js';

export interface ApiRequestOptions {
  env: EnvironmentName;
  method: HttpMethod;
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
}

/**
 * Optional static accessToken override. When set, `apiRequest` skips the
 * config-backed auth flow (no refresh, no persist) and just sends that token
 * via `Authorization: Bearer`. Used by the MCP server to honour
 * `CASHOP_ACCESS_TOKEN` in CI scenarios.
 */
let staticAccessToken: string | undefined;

export function setStaticAccessToken(token: string | undefined): void {
  staticAccessToken = token || undefined;
}

const EXPIRY_SKEW_MS = 30_000;

/**
 * Module-level refresh promise — coalesces concurrent refreshes so two
 * simultaneous API calls only trigger one `/token/refresh` call.
 */
const refreshInFlight: Map<EnvironmentName, Promise<AuthBundle>> = new Map();

async function refreshBundle(
  env: EnvironmentName,
  current: AuthBundle,
): Promise<AuthBundle> {
  const existing = refreshInFlight.get(env);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await refreshAccessToken(env, current.refreshToken);
      if (!res.accessToken) {
        throw new AuthenticationError('refresh 响应缺少 accessToken');
      }
      const next: AuthBundle = {
        accessToken: res.accessToken,
        // refreshToken may be rotated by the server; fall back to the prior one.
        refreshToken: res.refreshToken ?? current.refreshToken,
        expiresAt: Date.now() + (res.expiresIn ?? 0) * 1000,
        username: current.username,
        savedAt: Date.now(),
      };
      setAuth(env, next);
      return next;
    } catch (err) {
      clearAuth(env);
      const msg = err instanceof Error ? err.message : String(err);
      throw new AuthenticationError(`refresh 失败，请重新 login（${msg}）`);
    }
  })();

  refreshInFlight.set(env, promise);
  try {
    return await promise;
  } finally {
    refreshInFlight.delete(env);
  }
}

function isExpiringSoon(bundle: AuthBundle): boolean {
  return Date.now() >= bundle.expiresAt - EXPIRY_SKEW_MS;
}

async function getCurrentAccessToken(env: EnvironmentName): Promise<string> {
  if (staticAccessToken) return staticAccessToken;

  const bundle = getAuth(env);
  if (!bundle) {
    throw new AuthenticationError(
      `未登录 ${env} 环境，请运行 cashop-console --env ${env} auth login`,
    );
  }
  if (isExpiringSoon(bundle)) {
    const refreshed = await refreshBundle(env, bundle);
    return refreshed.accessToken;
  }
  return bundle.accessToken;
}

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, unknown>,
): string {
  const url = `${base}${path}`;
  if (!params || Object.keys(params).length === 0) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qs.append(k, String(v));
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${qs.toString()}`;
}

async function sendOnce<T>(
  options: ApiRequestOptions,
  accessToken: string,
): Promise<
  | { kind: 'ok'; data: T }
  | { kind: 'auth' }
  | { kind: 'error'; err: Error }
> {
  const environment = getEnvironment(options.env);
  const url = buildUrl(environment.apiUrl, options.url, options.params);

  const result = await requestJson<ApiResponse<T>>(url, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.data,
  });

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      return { kind: 'auth' };
    }
    const body = (result.data ?? {}) as Partial<ApiResponse<unknown>>;
    return {
      kind: 'error',
      err: new ApiError(
        result.status,
        body.message ?? `HTTP ${result.status}`,
        body.code !== undefined ? String(body.code) : undefined,
      ),
    };
  }

  const envelope = result.data;
  if (!envelope) {
    return {
      kind: 'error',
      err: new ApiError(result.status, 'Empty response body'),
    };
  }

  // Success: accept both new (code=0) and legacy (success=true / code=200).
  if (envelope.success || envelope.code === 0) {
    return { kind: 'ok', data: envelope.data };
  }

  if (envelope.code === 40103 || envelope.code === 4003 || envelope.code === 403) {
    return { kind: 'auth' };
  }

  return {
    kind: 'error',
    err: new ApiError(
      result.status,
      envelope.message ?? 'Request failed',
      String(envelope.code),
    ),
  };
}

/**
 * Perform an authenticated gateway request.
 *
 * Auth (accessToken / refreshToken) is resolved from config automatically,
 * with proactive refresh if the token is expiring within 30s. On 401 / 40103,
 * we refresh once and replay the request; a second failure surfaces as
 * `AuthenticationError`.
 */
export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const accessToken = await getCurrentAccessToken(options.env);
  const firstTry = await sendOnce<T>(options, accessToken);

  if (firstTry.kind === 'ok') return firstTry.data;
  if (firstTry.kind === 'error') throw firstTry.err;

  // kind === 'auth' — try one refresh + replay, unless we're using a static token.
  if (staticAccessToken) {
    throw new AuthenticationError('静态 token 已失效，请重新设置 CASHOP_ACCESS_TOKEN');
  }

  const bundle = getAuth(options.env);
  if (!bundle) {
    throw new AuthenticationError('未登录，请重新 login');
  }

  const refreshed = await refreshBundle(options.env, bundle);
  const retry = await sendOnce<T>(options, refreshed.accessToken);

  if (retry.kind === 'ok') return retry.data;
  if (retry.kind === 'auth') {
    clearAuth(options.env);
    throw new AuthenticationError('鉴权失败，请重新 login');
  }
  throw retry.err;
}
