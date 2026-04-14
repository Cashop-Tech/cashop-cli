import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';

export type Env = 'stable' | 'prod';

export interface PasswordToken {
  accessToken: string;
  refreshToken: string;
  expires_at: number;        // ms epoch, derived from expireTime ISO
  refresh_expires_at: number;
  userId: string;            // userId is a string (e.g. "531499234320648199")
  nickname?: string;
  email?: string;
}
export interface OAuthToken {
  access_token: string; refresh_token: string; expires_at: number;
  account: string; scopes: string[];
}
export interface ApiKeyToken { key: string; kid: string; name: string; }

interface Bag {
  oauth: Partial<Record<Env, OAuthToken>>;
  api_keys: Partial<Record<Env, ApiKeyToken>>;
  password_tokens: Partial<Record<Env, PasswordToken>>;
}

export interface Backend {
  read(): Promise<Bag>;
  write(b: Bag): Promise<void>;
}

const EMPTY: Bag = { oauth: {}, api_keys: {}, password_tokens: {} };

export class InMemoryBackend implements Backend {
  private bag: Bag = structuredClone(EMPTY);
  async read() { return structuredClone(this.bag); }
  async write(b: Bag) { this.bag = structuredClone(b); }
}

export class EncryptedFileBackend implements Backend {
  constructor(private path: string, private passphrase: string) {}
  async read(): Promise<Bag> {
    if (!existsSync(this.path)) return structuredClone(EMPTY);
    const raw = readFileSync(this.path);
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const key = scryptSync(this.passphrase, 'cashop-cli', 32);
    const d = createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]);
    return JSON.parse(pt.toString('utf8'));
  }
  async write(b: Bag): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    const iv = randomBytes(12);
    const key = scryptSync(this.passphrase, 'cashop-cli', 32);
    const c = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(b))), c.final()]);
    writeFileSync(this.path, Buffer.concat([iv, c.getAuthTag(), ct]));
    chmodSync(this.path, 0o600);
  }
}

export class KeytarBackend implements Backend {
  private service = 'cashop-cli';
  private account = 'default';
  async read(): Promise<Bag> {
    const { default: keytar } = await import('keytar');
    const raw = await keytar.getPassword(this.service, this.account);
    return raw ? JSON.parse(raw) : structuredClone(EMPTY);
  }
  async write(b: Bag): Promise<void> {
    const { default: keytar } = await import('keytar');
    await keytar.setPassword(this.service, this.account, JSON.stringify(b));
  }
}

export class TokenStore {
  constructor(private backend: Backend) {}
  async getPasswordToken(env: Env) { return (await this.backend.read()).password_tokens[env] ?? null; }
  async savePasswordToken(env: Env, tok: PasswordToken) {
    const b = await this.backend.read();
    b.password_tokens[env] = tok;
    await this.backend.write(b);
  }
  async clearPasswordToken(env: Env) {
    const b = await this.backend.read();
    delete b.password_tokens[env];
    await this.backend.write(b);
  }
  async getApiKey(env: Env) { return (await this.backend.read()).api_keys[env] ?? null; }
  async getOAuth(env: Env) { return (await this.backend.read()).oauth[env] ?? null; }
}

export async function selectBackend(passphrase: string): Promise<Backend> {
  try {
    const { default: keytar } = await import('keytar');
    await keytar.getPassword('cashop-cli', 'healthcheck');
    return new KeytarBackend();
  } catch {
    const fallbackPath = `${homedir()}/.cashop/credentials.enc`;
    return new EncryptedFileBackend(fallbackPath, passphrase);
  }
}
