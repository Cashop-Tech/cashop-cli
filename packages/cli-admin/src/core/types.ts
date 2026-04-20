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

export interface ApiContext {
  env: import('./environments.js').EnvironmentName;
  token: string;
}
