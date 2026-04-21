import type { EnvironmentName } from './environments.js';

export interface ApiResponse<T> {
  code: number;
  message: string;
  success: boolean;
  data: T;
}

export interface PageResult<T> {
  pageIndex: number;
  pageSize: number;
  total: number;
  pages: number;
  data: T[];
}

export interface PageQuery {
  pageIndex?: number;
  pageSize?: number;
}

/**
 * Context passed from a CLI command / MCP tool down to the API layer.
 *
 * Only the environment is required — auth (accessToken / refreshToken) is read
 * directly from config by `apiRequest`, with automatic refresh on expiry.
 */
export interface ApiContext {
  env: EnvironmentName;
}
