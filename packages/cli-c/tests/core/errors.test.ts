import { describe, it, expect } from 'vitest';
import {
  HttpError, BusinessError, ReauthRequired, BadArgsError, NetworkError,
  ForbiddenError, NotFoundError, ConflictError,
  exitCodeFor,
} from '@cashop/core';

describe('errors', () => {
  it('HttpError carries status + body', () => {
    const e = new HttpError(502, { message: 'bad gateway' });
    expect(e.status).toBe(502);
    expect(e.body).toEqual({ message: 'bad gateway' });
    expect(e.message).toContain('502');
  });

  it('BusinessError carries code + message + raw body', () => {
    const e = new BusinessError('702021', '账号或密码错误', { success: false });
    expect(e.code).toBe('702021');
    expect(e.message).toContain('账号或密码错误');
    expect(e.body).toEqual({ success: false });
  });

  it('ReauthRequired is a distinct class', () => {
    expect(new ReauthRequired() instanceof HttpError).toBe(false);
  });

  it('exitCodeFor maps all classes', () => {
    expect(exitCodeFor(new BadArgsError('x'))).toBe(2);
    expect(exitCodeFor(new NetworkError('x'))).toBe(3);
    expect(exitCodeFor(new ReauthRequired())).toBe(4);
    expect(exitCodeFor(new ForbiddenError('x'))).toBe(5);
    expect(exitCodeFor(new NotFoundError('x'))).toBe(6);
    expect(exitCodeFor(new ConflictError('x'))).toBe(7);
    expect(exitCodeFor(new BusinessError('X', 'msg', {}))).toBe(1);
    expect(exitCodeFor(new Error('anything'))).toBe(1);
  });
});
