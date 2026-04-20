import { requestJson, type HttpMethod } from '@cashop/core';
import { getEnvironment, type EnvironmentName } from './environments.js';
import { ApiError, AuthenticationError } from './errors.js';
import { getAuthHeaders } from './token.js';
import type { ApiResponse } from './types.js';

export interface ApiRequestOptions {
  env: EnvironmentName;
  token: string;
  method: HttpMethod;
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  baseUrlType?: 'api' | 'sso';
}

/**
 * Transport for the Cashop admin gateway.
 *
 * Behaviour preserved from the old axios-based client:
 *  - For 'api' endpoints, inject X-AUTHENTICATION (+ MD5-derived header for external users).
 *  - For 'sso' endpoints, inject only X-AUTHENTICATION.
 *  - Auto-unwrap the `{code, success, message, data}` envelope and return `data`.
 *  - Map HTTP 401/403 and body codes 4003/403 to AuthenticationError.
 *  - Map any other non-success (HTTP error or envelope success=false) to ApiError.
 *
 * Underlying HTTP primitive comes from @cashop/core (`requestJson`): fetch + timeout +
 * retries + raw JSON parsing. No auth-specific logic lives in the primitive.
 */
export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const environment = getEnvironment(options.env);
  const baseUrl =
    options.baseUrlType === 'sso' ? environment.ssoLoginUrl : environment.apiUrl;

  const authHeaders =
    options.baseUrlType === 'sso'
      ? { 'X-AUTHENTICATION': options.token }
      : getAuthHeaders(options.token);

  const url = buildUrl(baseUrl, options.url, options.params);

  const result = await requestJson<ApiResponse<T>>(url, {
    method: options.method,
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: options.data,
  });

  // HTTP-level failure (5xx, unexpected 4xx that returned a parseable body).
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      throw new AuthenticationError();
    }
    const body = (result.data ?? {}) as Partial<ApiResponse<unknown>>;
    const message = body.message ?? `HTTP ${result.status}`;
    const code = body.code !== undefined ? String(body.code) : undefined;
    throw new ApiError(result.status, message, code);
  }

  // Successful HTTP — inspect envelope.
  const envelope = result.data;
  if (!envelope) {
    throw new ApiError(result.status, 'Empty response body');
  }

  if (envelope.success) {
    return envelope.data;
  }

  if (envelope.code === 4003 || envelope.code === 403) {
    throw new AuthenticationError(envelope.message);
  }

  throw new ApiError(result.status, envelope.message, String(envelope.code));
}

function buildUrl(base: string, path: string, params?: Record<string, unknown>): string {
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
