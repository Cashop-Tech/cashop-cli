import { describe, it, expect } from 'vitest';
import {
  BadArgsError,
  NetworkError,
  ReauthRequired,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  exitCodeFor,
  friendlyBusinessMessage,
} from '../src/errors.js';

describe('exitCodeFor', () => {
  it('maps known error classes to stable exit codes', () => {
    expect(exitCodeFor(new BadArgsError())).toBe(2);
    expect(exitCodeFor(new NetworkError())).toBe(3);
    expect(exitCodeFor(new ReauthRequired())).toBe(4);
    expect(exitCodeFor(new ForbiddenError())).toBe(5);
    expect(exitCodeFor(new NotFoundError())).toBe(6);
    expect(exitCodeFor(new ConflictError())).toBe(7);
  });

  it('defaults unknown errors to 1', () => {
    expect(exitCodeFor(new Error('boom'))).toBe(1);
    expect(exitCodeFor('string error')).toBe(1);
  });
});

describe('friendlyBusinessMessage', () => {
  it('returns apikey-specific messages for known codes', () => {
    expect(friendlyBusinessMessage('703012', 'fallback')).toContain('10 API keys');
    expect(friendlyBusinessMessage('703015', 'fallback')).toContain('not found');
  });

  it('falls back for unknown codes', () => {
    expect(friendlyBusinessMessage('999999', 'fallback-msg')).toBe('fallback-msg');
  });
});
