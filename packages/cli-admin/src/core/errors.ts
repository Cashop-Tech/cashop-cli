export class CashopError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CashopError';
  }
}

export class AuthenticationError extends CashopError {
  constructor(message = 'Authentication required. Run: cashop-console auth login') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class ApiError extends CashopError {
  constructor(public statusCode: number, message: string, code?: string) {
    super(`API Error [${code ?? statusCode}]: ${message}`, code);
    this.name = 'ApiError';
  }
}
