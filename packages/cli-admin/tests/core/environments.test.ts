import { describe, it, expect } from 'vitest';
import {
  getEnvironment,
  DEFAULT_ENVIRONMENT,
  type EnvironmentName,
} from '../../src/core/environments.js';

describe('DEFAULT_ENVIRONMENT', () => {
  it('is "prod"', () => {
    expect(DEFAULT_ENVIRONMENT).toBe('prod');
  });
});

describe('getEnvironment', () => {
  it('returns the stable environment with correct apiUrl', () => {
    const env = getEnvironment('stable');
    expect(env.name).toBe('stable');
    expect(env.apiUrl).toBe('https://api.castable.hk');
  });

  it('returns the prod environment with correct apiUrl', () => {
    const env = getEnvironment('prod');
    expect(env.name).toBe('prod');
    expect(env.apiUrl).toBe('https://api.cashop.com');
  });

  it('every environment has a non-empty apiUrl', () => {
    const envNames: EnvironmentName[] = ['stable', 'prod'];
    for (const name of envNames) {
      expect(getEnvironment(name).apiUrl).toBeTruthy();
    }
  });

  it('returns an object whose name matches the requested environment', () => {
    const envNames: EnvironmentName[] = ['stable', 'prod'];
    for (const name of envNames) {
      expect(getEnvironment(name).name).toBe(name);
    }
  });
});
