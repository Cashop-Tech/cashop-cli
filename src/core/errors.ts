export class HttpError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}
export class BusinessError extends Error {
  constructor(public code: string, message: string, public body: unknown) {
    super(`[${code}] ${message}`);
    this.name = 'BusinessError';
  }
}
export class ReauthRequired extends Error {
  constructor() { super('Re-authentication required'); this.name = 'ReauthRequired'; }
}
export class BadArgsError extends Error { name = 'BadArgsError'; }
export class NetworkError extends Error { name = 'NetworkError'; }
export class ForbiddenError extends Error { name = 'ForbiddenError'; }
export class NotFoundError extends Error { name = 'NotFoundError'; }
export class ConflictError extends Error { name = 'ConflictError'; }
export class CashopCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CashopCliError';
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof BadArgsError) return 2;
  if (err instanceof NetworkError) return 3;
  if (err instanceof ReauthRequired) return 4;
  if (err instanceof ForbiddenError) return 5;
  if (err instanceof NotFoundError) return 6;
  if (err instanceof ConflictError) return 7;
  return 1;
}
