import { describe, it, expect } from 'vitest';
import { CashopError, AuthenticationError, ApiError } from '../../src/core/errors.js';

describe('CashopError', () => {
  it('has the correct name', () => {
    const err = new CashopError('something went wrong');
    expect(err.name).toBe('CashopError');
  });

  it('has the correct message', () => {
    const err = new CashopError('something went wrong');
    expect(err.message).toBe('something went wrong');
  });

  it('stores an optional code', () => {
    const err = new CashopError('oops', 'ERR_CODE');
    expect(err.code).toBe('ERR_CODE');
  });

  it('code is undefined when not provided', () => {
    const err = new CashopError('oops');
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    expect(new CashopError('x')).toBeInstanceOf(Error);
  });
});

describe('AuthenticationError', () => {
  it('has the correct name', () => {
    const err = new AuthenticationError();
    expect(err.name).toBe('AuthenticationError');
  });

  it('uses the default message when none is supplied', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication required. Run: cashop-console auth login');
  });

  it('accepts a custom message', () => {
    const err = new AuthenticationError('token expired');
    expect(err.message).toBe('token expired');
  });

  it('has code AUTH_ERROR', () => {
    const err = new AuthenticationError();
    expect(err.code).toBe('AUTH_ERROR');
  });

  it('is an instance of CashopError', () => {
    expect(new AuthenticationError()).toBeInstanceOf(CashopError);
  });
});

describe('ApiError', () => {
  it('has the correct name', () => {
    const err = new ApiError(404, 'not found', '404');
    expect(err.name).toBe('ApiError');
  });

  it('formats message using code when provided', () => {
    const err = new ApiError(422, 'invalid input', 'VALIDATION');
    expect(err.message).toBe('API Error [VALIDATION]: invalid input');
  });

  it('falls back to statusCode in message when code is not provided', () => {
    const err = new ApiError(500, 'server error');
    expect(err.message).toBe('API Error [500]: server error');
  });

  it('stores the statusCode', () => {
    const err = new ApiError(404, 'not found');
    expect(err.statusCode).toBe(404);
  });

  it('stores the optional code', () => {
    const err = new ApiError(400, 'bad request', 'BAD_REQ');
    expect(err.code).toBe('BAD_REQ');
  });

  it('is an instance of CashopError', () => {
    expect(new ApiError(400, 'bad')).toBeInstanceOf(CashopError);
  });
});
