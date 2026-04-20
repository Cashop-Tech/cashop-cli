import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthenticationError } from '../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Mock the config module so we can control what getToken / readConfig return
// without touching the filesystem.
// ---------------------------------------------------------------------------
const mockGetToken = vi.fn<[string], string | undefined>();
const mockReadConfig = vi.fn();

vi.mock('../../src/core/config.js', () => ({
  getToken: (env: string) => mockGetToken(env),
  readConfig: () => mockReadConfig(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearCashopTokenEnv() {
  delete process.env['CASHOP_TOKEN'];
}

// Import under test (after mocks are declared so the mock is active).
import { resolveToken, resolveAuthContext } from '../../src/core/auth.js';

beforeEach(() => {
  clearCashopTokenEnv();
  mockGetToken.mockReset();
  mockReadConfig.mockReset();
  // Default: no stored env override in config
  mockReadConfig.mockReturnValue({});
});

afterEach(() => {
  clearCashopTokenEnv();
});

describe('resolveToken — priority order', () => {
  it('uses options.token (CLI flag) first, even when env var is set', () => {
    process.env['CASHOP_TOKEN'] = 'env-token';
    mockGetToken.mockReturnValue('config-token');
    mockReadConfig.mockReturnValue({});

    const token = resolveToken({ token: 'flag-token', env: 'stable' });
    expect(token).toBe('flag-token');
  });

  it('uses CASHOP_TOKEN env var when no flag is provided', () => {
    process.env['CASHOP_TOKEN'] = 'env-token';
    mockGetToken.mockReturnValue('config-token');

    const token = resolveToken({ env: 'stable' });
    expect(token).toBe('env-token');
  });

  it('falls back to the config token when flag and env var are absent', () => {
    mockGetToken.mockReturnValue('config-token');

    const token = resolveToken({ env: 'stable' });
    expect(token).toBe('config-token');
  });

  it('throws AuthenticationError when no token source is available', () => {
    mockGetToken.mockReturnValue(undefined);

    expect(() => resolveToken({ env: 'stable' })).toThrowError(AuthenticationError);
  });

  it('throws AuthenticationError with the default message when token is missing', () => {
    mockGetToken.mockReturnValue(undefined);

    expect(() => resolveToken({ env: 'stable' })).toThrowError(
      'Authentication required. Run: cashop-console auth login',
    );
  });
});

describe('resolveToken — environment resolution for config lookup', () => {
  it('looks up the token using the explicitly provided env', () => {
    mockGetToken.mockReturnValue('prod-token');

    resolveToken({ env: 'prod' });
    expect(mockGetToken).toHaveBeenCalledWith('prod');
  });

  it('uses the env stored in config when options.env is omitted', () => {
    mockReadConfig.mockReturnValue({ env: 'stable' });
    mockGetToken.mockReturnValue('stable-token');

    const token = resolveToken({});
    expect(token).toBe('stable-token');
    expect(mockGetToken).toHaveBeenCalledWith('stable');
  });

  it('defaults to "prod" when neither options.env nor config.env is set', () => {
    mockReadConfig.mockReturnValue({});
    mockGetToken.mockReturnValue('prod-token');

    resolveToken({});
    expect(mockGetToken).toHaveBeenCalledWith('prod');
  });
});

describe('resolveAuthContext', () => {
  it('returns token and env when flag token is provided', () => {
    const ctx = resolveAuthContext({ token: 'flag-token', env: 'prod' });
    expect(ctx.token).toBe('flag-token');
    expect(ctx.env).toBe('prod');
  });

  it('resolves env from config when options.env is not given', () => {
    mockReadConfig.mockReturnValue({ env: 'stable' });
    mockGetToken.mockReturnValue('stable-token');

    const ctx = resolveAuthContext({});
    expect(ctx.env).toBe('stable');
    expect(ctx.token).toBe('stable-token');
  });

  it('defaults env to "prod" when config has no env', () => {
    mockReadConfig.mockReturnValue({});
    mockGetToken.mockReturnValue('prod-token');

    const ctx = resolveAuthContext({});
    expect(ctx.env).toBe('prod');
  });

  it('uses CASHOP_TOKEN env var and keeps the resolved env', () => {
    process.env['CASHOP_TOKEN'] = 'env-token';
    mockReadConfig.mockReturnValue({});

    const ctx = resolveAuthContext({ env: 'prod' });
    expect(ctx.token).toBe('env-token');
    expect(ctx.env).toBe('prod');
  });

  it('throws AuthenticationError when no token is resolvable', () => {
    mockReadConfig.mockReturnValue({});
    mockGetToken.mockReturnValue(undefined);

    expect(() => resolveAuthContext({ env: 'stable' })).toThrowError(AuthenticationError);
  });
});
