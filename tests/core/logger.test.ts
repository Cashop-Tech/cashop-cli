import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '../../src/core/logger.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cashop-log-')); });

describe('logger', () => {
  it('writes info lines to file regardless of verbose flag', () => {
    const log = createLogger({ logDir: dir, verbose: false });
    log.info('hello');
    log.close();
    const files = readDir(dir);
    expect(files.length).toBe(1);
    expect(readFileSync(join(dir, files[0]!), 'utf8')).toContain('hello');
  });

  it('debug lines skip file when verbose=false', () => {
    const log = createLogger({ logDir: dir, verbose: false });
    log.debug('chatter');
    log.close();
    const files = readDir(dir);
    const content = files[0] ? readFileSync(join(dir, files[0]!), 'utf8') : '';
    expect(content).not.toContain('chatter');
  });

  it('debug lines write when verbose=true', () => {
    const log = createLogger({ logDir: dir, verbose: true });
    log.debug('chatter');
    log.close();
    const files = readDir(dir);
    expect(readFileSync(join(dir, files[0]!), 'utf8')).toContain('chatter');
  });
});

function readDir(d: string): string[] {
  return require('node:fs').readdirSync(d).filter((f: string) => f.endsWith('.log'));
}
