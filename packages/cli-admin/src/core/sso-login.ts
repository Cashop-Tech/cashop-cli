import http from 'node:http';
import { createHash } from 'node:crypto';
import open from 'open';
import axios from 'axios';
import { getEnvironment, type EnvironmentName } from './environments.js';
import { apiRequest } from './client.js';
import { setToken, setConfigValue } from './config.js';
import chalk from 'chalk';

function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

/**
 * HTML page shown when code exchange fails.
 * Provides a form to manually paste the X-AUTHENTICATION cookie value.
 */
function tokenInputPage(port: number, env: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cashop Console - Complete Login</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #333; }
    h1 { color: #1a1a1a; }
    .info { background: #f0f7ff; border: 1px solid #b3d4fc; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .steps { background: #f9f9f9; border-radius: 8px; padding: 16px 16px 16px 20px; margin: 20px 0; }
    .steps li { margin: 8px 0; }
    code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    input[type="text"] { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    button { background: #0066cc; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer; margin-top: 10px; }
    button:hover { background: #0052a3; }
    .error { color: #cc0000; margin-top: 8px; display: none; }
  </style>
</head>
<body>
  <h1>Almost there!</h1>
  <div class="info">
    SSO login succeeded, but automatic token exchange is not available in this environment.
    Please paste your authentication token below.
  </div>
  <div class="steps">
    <strong>How to get your token:</strong>
    <ol>
      <li>Open <strong>DevTools</strong> in the browser where you just logged in (F12 or Cmd+Option+I)</li>
      <li>Go to <strong>Application</strong> tab &rarr; <strong>Cookies</strong> &rarr; select the login domain</li>
      <li>Find the cookie named <code>X-AUTHENTICATION</code></li>
      <li>Copy its <strong>Value</strong> and paste it below</li>
    </ol>
  </div>
  <form id="tokenForm">
    <input type="text" id="token" name="token" placeholder="Paste your X-AUTHENTICATION cookie value here" autofocus>
    <div class="error" id="error">Token cannot be empty</div>
    <button type="submit">Complete Login</button>
  </form>
  <script>
    document.getElementById('tokenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('token').value.trim();
      if (!token) {
        document.getElementById('error').style.display = 'block';
        return;
      }
      document.getElementById('error').style.display = 'none';
      try {
        const res = await fetch('http://localhost:${port}/submit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, env: '${env}' }),
        });
        const data = await res.json();
        if (data.success) {
          document.body.innerHTML = '<h1 style="color: #0a8a0a;">Login successful!</h1><p>You can close this tab. User: ' + data.userName + '</p>';
        } else {
          document.getElementById('error').textContent = data.error || 'Token validation failed';
          document.getElementById('error').style.display = 'block';
        }
      } catch (err) {
        document.getElementById('error').textContent = 'Failed to submit token: ' + err.message;
        document.getElementById('error').style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}

export async function startSsoLogin(env: EnvironmentName): Promise<void> {
  const environment = getEnvironment(env);
  const ssoUrl = environment.ssoLoginUrl;
  // Use ssoCoreUrl (sso-center-inner.*) for token exchange since login.* doesn't
  // route /api/v1/sso/authentication/* to security-sso-core
  const ssoApiUrl = process.env['CASHOP_SSO_API_URL'] ?? environment.ssoCoreUrl;

  // Find available port starting from 19876
  let port = 19876;
  const server = http.createServer();

  await new Promise<void>((resolve, reject) => {
    const tryListen = () => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          port++;
          tryListen();
        } else {
          reject(err);
        }
      });
      server.listen(port, () => resolve());
    };
    tryListen();
  });

  const redirectUrl = `http://localhost:${port}/callback`;
  const loginUrl = `${ssoUrl}?redirectUrl=${encodeURIComponent(redirectUrl)}`;

  console.log(chalk.blue('Opening browser for SSO login...'));
  console.log(chalk.dim(`If browser doesn't open, visit: ${loginUrl}`));

  await open(loginUrl);

  // Wait for callback with a 5-minute timeout
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('SSO login timed out after 5 minutes'));
    }, 5 * 60 * 1000);

    const finishLogin = async (token: string): Promise<{ success: boolean; userName?: string; error?: string }> => {
      try {
        setToken(env, token);
        setConfigValue('env', env);

        const userInfo = await apiRequest<Record<string, unknown>>({
          env,
          token,
          method: 'GET',
          url: '/api/v1/login-user/user-info',
          baseUrlType: 'sso',
        });

        const displayName = (userInfo.userName ?? userInfo.username ?? userInfo.realName ?? 'unknown') as string;
        console.log(chalk.green(`\u2713 Logged in as ${displayName} (${env})`));
        return { success: true, userName: displayName };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    };

    server.on('request', (req, res) => {
      const rawUrl = req.url ?? '/';
      const url = new URL(rawUrl, `http://localhost:${port}`);

      // Handle manual token submission from the fallback HTML page
      if (url.pathname === '/submit-token' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          void (async () => {
            try {
              const { token } = JSON.parse(body) as { token: string };
              const result = await finishLogin(token);
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify(result));
              if (result.success) {
                clearTimeout(timeout);
                server.close();
                resolve();
              }
            } catch (err) {
              res.writeHead(400, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
          })();
        });
        return;
      }

      // Handle CORS preflight for submit-token
      if (url.pathname === '/submit-token' && req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const authorizeCode =
        url.searchParams.get('authorizeCode') ?? url.searchParams.get('code');

      if (!authorizeCode) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Missing authorization code</h1></body></html>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('SSO callback did not contain an authorization code'));
        return;
      }

      // Exchange code for token asynchronously, then respond
      void (async () => {
        try {
          const token = await exchangeCodeForToken(ssoApiUrl, authorizeCode);

          const result = await finishLogin(token);
          if (result.success) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>Login successful! You can close this tab.</h1></body></html>',
            );
            clearTimeout(timeout);
            server.close();
            resolve();
          } else {
            throw new Error(result.error ?? 'Token validation failed');
          }
        } catch (exchangeErr) {
          // Code exchange failed — log the actual error for diagnosis
          const errDetail = exchangeErr instanceof Error ? exchangeErr.message : String(exchangeErr);
          console.error(chalk.red(`\nToken exchange failed: ${errDetail}`));
          if (axios.isAxiosError(exchangeErr)) {
            const status = exchangeErr.response?.status;
            const respData = exchangeErr.response?.data;
            console.error(chalk.red(`  HTTP ${status}: ${JSON.stringify(respData)}`));
          }
          // Show manual token input page as fallback
          console.log(chalk.yellow(
            'Falling back to manual token input. Please paste your token in the browser page.',
          ));
          console.log(chalk.dim(
            'Alternatively, copy the X-AUTHENTICATION cookie from your browser and run:',
          ));
          console.log(chalk.dim(
            `  cashop-console auth login --token <token> --env ${env}`,
          ));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(tokenInputPage(port, env));
          // Don't close server — wait for manual token submission
        }
      })();
    });
  });
}

/**
 * Exchange an SSO authorize code for an authentication token.
 * Calls POST /api/v1/sso/authentication/access-token with form-urlencoded data.
 */
async function exchangeCodeForToken(ssoApiUrl: string, authorizeCode: string): Promise<string> {
  const appId = process.env['CASHOP_SSO_APP_ID'] ?? 'cashop-management';
  const appSecret = process.env['CASHOP_SSO_APP_SECRET'] ?? 'cashop-management-secret';
  const grantType = 'AUTHENTICATE';
  const timestamp = Date.now().toString();

  // ssoSign = MD5(appId + appSecret + grantType + authorizeCode + timestamp + appSecret)
  const ssoSign = md5(`${appId}${appSecret}${grantType}${authorizeCode}${timestamp}${appSecret}`);

  const formData = new URLSearchParams({
    appId,
    appSecret,
    grantType,
    authorizeCode,
    timestamp,
    ssoSign,
  });

  const tokenResponse = await axios.post<{
    code: number;
    message: string;
    data: string;
  }>(
    `${ssoApiUrl}/api/v1/sso/authentication/access-token`,
    formData.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        appId,
        appSecret,
        ssoSign,
      },
      timeout: 10000,
    },
  );

  const respData = tokenResponse.data;
  if (!respData || !respData.data) {
    throw new Error(
      respData?.message
        ? `SSO token exchange failed: ${respData.message} (code: ${respData.code})`
        : 'SSO token exchange returned empty response (endpoint may not be proxied)',
    );
  }

  return respData.data;
}
