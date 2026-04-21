import readline from 'node:readline';
import chalk from 'chalk';
import { z } from 'zod';
import { login, type LoginResponse } from '../api/internal-auth.js';
import { setAuth, setConfigValue, type AuthBundle } from './config.js';
import type { EnvironmentName } from './environments.js';
import { ApiError, AuthenticationError } from './errors.js';

const totpSchema = z.string().regex(/^\d{6}$/, 'TOTP 必须是 6 位数字');

export interface InteractiveLoginOptions {
  env: EnvironmentName;
  username?: string;
  password?: string;
  totp?: string;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, (answer) => resolve(answer));
    });
  } finally {
    rl.close();
  }
}

/**
 * Prompt for a password with echo suppressed.
 *
 * We switch stdin into raw mode and write '*' per keystroke. This keeps us
 * dependency-free (no inquirer) while giving users the expected hidden input.
 */
async function promptPassword(question: string): Promise<string> {
  process.stdout.write(question);

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf-8');

  return new Promise<string>((resolve, reject) => {
    let buffer = '';

    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (ch === '\n' || ch === '\r') {
          cleanup();
          process.stdout.write('\n');
          resolve(buffer);
          return;
        }
        if (code === 3) {
          // Ctrl+C
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Aborted'));
          return;
        }
        if (ch === '\u007f' || code === 8) {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (code < 0x20) continue;
        buffer += ch;
        process.stdout.write('*');
      }
    };

    const cleanup = (): void => {
      stdin.removeListener('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

function bundleFromResponse(
  res: LoginResponse,
  username: string,
): AuthBundle {
  return {
    accessToken: res.accessToken!,
    refreshToken: res.refreshToken!,
    expiresAt: Date.now() + (res.expiresIn ?? 0) * 1000,
    username,
    savedAt: Date.now(),
  };
}

export interface InternalLoginResult {
  bundle: AuthBundle;
  env: EnvironmentName;
}

/**
 * Run the username + password (+ TOTP) login flow for the given environment
 * and persist the resulting AuthBundle into config.
 */
export async function runInternalLogin(
  options: InteractiveLoginOptions,
): Promise<InternalLoginResult> {
  const env = options.env;

  const username = options.username ?? (await prompt('用户名：')).trim();
  if (!username) {
    throw new Error('用户名不能为空');
  }

  const password = options.password ?? (await promptPassword('密码：'));
  if (!password) {
    throw new Error('密码不能为空');
  }

  let totp = options.totp;

  // First attempt
  let res: LoginResponse;
  try {
    res = await login(env, {
      username,
      password,
      totpCode: totp,
    });
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof ApiError) {
      throw new Error(`登录失败：${err.message}`);
    }
    throw err;
  }

  if (res.needSetup) {
    const step = res.setupStep ?? 'reset_password';
    throw new Error(
      `账号需要首次设置（${step}）。请先在运营管理后台 web 完成密码重置和 Google Authenticator 绑定，再回到 CLI 登录。`,
    );
  }

  // If server requests TOTP and we didn't provide it, prompt now.
  if (res.needTotp && !res.accessToken) {
    if (!totp) {
      const input = (await prompt('Google Authenticator 验证码（6 位）：')).trim();
      totpSchema.parse(input);
      totp = input;
    } else {
      totpSchema.parse(totp);
    }
    try {
      res = await login(env, { username, password, totpCode: totp });
    } catch (err) {
      if (err instanceof AuthenticationError || err instanceof ApiError) {
        throw new Error(`登录失败：${err.message}`);
      }
      throw err;
    }
  }

  if (!res.accessToken || !res.refreshToken) {
    throw new Error('登录响应缺少 accessToken / refreshToken');
  }

  const bundle = bundleFromResponse(res, username);
  setAuth(env, bundle);
  setConfigValue('env', env);

  return { bundle, env };
}

export function formatLoginSuccess(env: EnvironmentName, bundle: AuthBundle): string {
  const expiresMin = Math.max(0, Math.round((bundle.expiresAt - Date.now()) / 60_000));
  return chalk.green(
    `✓ 已登录：${bundle.username ?? ''}（${env}，accessToken ${expiresMin} 分钟后过期）`,
  );
}
