import { createCipheriv, randomUUID } from 'node:crypto';
import * as readline from 'node:readline';
import axios from 'axios';
import chalk from 'chalk';
import { getEnvironment, type EnvironmentName } from './environments.js';
import { apiRequest } from './client.js';
import { setToken, setConfigValue } from './config.js';

// ---------------------------------------------------------------------------
// DES encryption (matches Java: DES/ECB/PKCS7Padding with BouncyCastle)
// ---------------------------------------------------------------------------

function desEncrypt(data: string, key: string): string {
  // Java's DESKeySpec takes the first 8 bytes of the key
  const keyBuffer = Buffer.from(key, 'utf-8').subarray(0, 8);
  const cipher = createCipheriv('des-ecb', keyBuffer, null);
  let encrypted = cipher.update(data, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// ---------------------------------------------------------------------------
// Terminal prompts
// ---------------------------------------------------------------------------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, terminal: true });
    process.stdout.write(question);

    // Mute output during password entry
    const stdin = process.stdin;
    const rawMode = stdin.isRaw;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let password = '';
    const onData = (ch: Buffer) => {
      const char = ch.toString('utf-8');
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          if (stdin.isTTY) {
            stdin.setRawMode(rawMode ?? false);
          }
          stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          if (stdin.isTTY) {
            stdin.setRawMode(rawMode ?? false);
          }
          stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u007F': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };

    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// SSO VPN login response types
// ---------------------------------------------------------------------------

interface LoginCookieResponse {
  name: string;
  value: string;
  domain: string;
  maxAge: number;
}

interface LoginResponse {
  username: string;
  grantType: string;
  code: string;
  redirectUrl: string;
  cookieDatas: LoginCookieResponse[];
  isCors: boolean;
  needChangePwd: boolean;
}

interface SsoResult<T> {
  code: number;
  message: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Credential login
// ---------------------------------------------------------------------------

export async function startCredentialLogin(env: EnvironmentName): Promise<void> {
  const environment = getEnvironment(env);
  const ssoUrl = environment.ssoLoginUrl;

  const username = await prompt('Username: ');
  if (!username) {
    console.error(chalk.red('Username cannot be empty'));
    process.exit(1);
  }

  const password = await promptPassword('Password: ');
  if (!password) {
    console.error(chalk.red('Password cannot be empty'));
    process.exit(1);
  }

  // Generate requestId as DES encryption key
  const requestId = randomUUID();
  const encryptedPassword = desEncrypt(password, requestId);

  // Try VPN login (skips slider captcha)
  let captcha: string | undefined;

  const doLogin = async (): Promise<LoginResponse> => {
    const loginUrl = `${ssoUrl}/web/v1/sso/login`;

    const body: Record<string, unknown> = {
      username,
      password: encryptedPassword,
    };
    if (captcha) {
      body.captcha = captcha;
    }

    const response = await axios.post<SsoResult<LoginResponse>>(loginUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        requestId,
      },
      timeout: 15000,
    });

    const result = response.data;
    if (!result || result.code !== 200) {
      throw new LoginError(result?.message ?? 'Login failed', result?.code);
    }

    return result.data;
  };

  try {
    let loginResp: LoginResponse;
    try {
      loginResp = await doLogin();
    } catch (err) {
      if (err instanceof LoginError && err.ssoCode === 1018) {
        // SMS_CODE_EMPTY — server requires SMS verification
        console.log(chalk.yellow('SMS verification required.'));

        // Send SMS code
        try {
          await axios.post(`${ssoUrl}/web/v1/sso/smscode`, null, {
            params: { username, deviceId: 'cashop-cli' },
            headers: { 'Content-Type': 'application/json', requestId },
            timeout: 15000,
          });
          console.log(chalk.dim('SMS code sent to your registered phone number.'));
        } catch {
          console.log(chalk.dim('SMS code may have been sent. Please check your phone.'));
        }

        captcha = await prompt('SMS Code: ');
        if (!captcha) {
          console.error(chalk.red('SMS code cannot be empty'));
          process.exit(1);
        }
        loginResp = await doLogin();
      } else {
        throw err;
      }
    }

    // Extract token from response
    const token = extractToken(loginResp);
    if (!token) {
      throw new Error('Login succeeded but no authentication token in response');
    }

    setToken(env, token);
    setConfigValue('env', env);

    // Verify token by fetching user info
    try {
      const userInfo = await apiRequest<Record<string, unknown>>({
        env,
        token,
        method: 'GET',
        url: '/api/v1/login-user/user-info',
        baseUrlType: 'sso',
      });
      const displayName = (userInfo.userName ?? userInfo.username ?? userInfo.realName ?? loginResp.username ?? 'unknown') as string;
      console.log(chalk.green(`\u2713 Logged in as ${displayName} (${env})`));
    } catch {
      // Token works for login but user-info may fail — still save it
      console.log(chalk.green(`\u2713 Logged in as ${loginResp.username} (${env})`));
    }
  } catch (err) {
    if (err instanceof LoginError) {
      console.error(chalk.red(`\u2717 Login failed: ${err.message}`));
    } else if (axios.isAxiosError(err)) {
      const msg = err.response?.data?.message ?? err.message;
      console.error(chalk.red(`\u2717 Login failed: ${msg}`));
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\u2717 Login failed: ${msg}`));
    }
    process.exit(1);
  }
}

function extractToken(resp: LoginResponse): string | undefined {
  // First try cookieDatas for X-AUTHENTICATION
  if (resp.cookieDatas?.length) {
    const authCookie = resp.cookieDatas.find((c) => c.name === 'X-AUTHENTICATION');
    if (authCookie?.value) return authCookie.value;
    // Fallback to first cookie value
    if (resp.cookieDatas[0]?.value) return resp.cookieDatas[0].value;
  }
  // Fallback to response code field (which IS the auth token)
  if (resp.code) return resp.code;
  return undefined;
}

class LoginError extends Error {
  constructor(
    message: string,
    public ssoCode?: number,
  ) {
    super(message);
    this.name = 'LoginError';
  }
}
