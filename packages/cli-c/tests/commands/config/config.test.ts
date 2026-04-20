import { describe, it, expect } from 'vitest';
import { defaultConfig, getField, setField } from '../../../src/core/config.js';

describe('config helpers', () => {
  it('getField reads nested path', () => {
    expect(getField(defaultConfig, 'api.stable')).toBe('http://159.138.7.47');
    expect(getField(defaultConfig, 'env')).toBe('stable');
  });

  it('setField returns new object with updated leaf', () => {
    const next = setField(defaultConfig, 'output', 'json');
    expect(next.output).toBe('json');
    expect(defaultConfig.output).toBe('pretty');
  });

  it('setField coerces booleans and numbers', () => {
    const next = setField(defaultConfig, 'auto_confirm', 'true');
    expect(next.auto_confirm).toBe(true);
  });
});
