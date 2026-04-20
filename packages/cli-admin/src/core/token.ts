import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Token payload (base64-encoded JSON)
// ---------------------------------------------------------------------------

export interface TokenPayload {
  userId: string;
  usercode: string;
  username: string;
  realname: string;
  userType: 'INNER' | 'EXTERNAL';
  accessToken: string;
  loginAppId: string;
  invalidTime: number;
  version: string;
  timestamp: number;
  extra: string;
}

/**
 * Decode a Cashop auth token (base64 JSON) into its payload.
 * Returns null if the token is not a valid base64 JSON string.
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as TokenPayload;
    if (!payload.userType || !payload.username) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * For external users, the API gateway requires an additional header whose name
 * is MD5('X-AUTHENTICATION_' + appId).toUpperCase().
 *
 * Returns the header name, or null for internal users.
 */
export function getExternalHeaderName(appId: string): string {
  return createHash('md5')
    .update(`X-AUTHENTICATION_${appId}`)
    .digest('hex')
    .toUpperCase();
}

/**
 * Compute the auth headers needed for API requests.
 *
 * - Internal users: { 'X-AUTHENTICATION': token }
 * - External users: { 'X-AUTHENTICATION': token, '<MD5_HASH>': token }
 */
export function getAuthHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-AUTHENTICATION': token,
  };

  const payload = decodeToken(token);
  if (payload?.userType === 'EXTERNAL' && payload.loginAppId) {
    const externalName = getExternalHeaderName(payload.loginAppId);
    headers[externalName] = token;
  }

  return headers;
}
