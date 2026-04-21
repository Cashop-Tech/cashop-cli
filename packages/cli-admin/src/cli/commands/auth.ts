import { Command } from 'commander';
import chalk from 'chalk';
import { getAuth, clearAuth, setAuth, readConfig } from '../../core/config.js';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from '../../core/environments.js';
import {
  runInternalLogin,
  formatLoginSuccess,
} from '../../core/internal-auth-login.js';
import {
  getMe,
  logout as logoutApi,
  refreshAccessToken,
} from '../../api/internal-auth.js';

function resolveEnv(cmd: Command): EnvironmentName {
  const opts = cmd.optsWithGlobals<{ env?: string }>();
  const cfg = readConfig();
  return (opts.env ?? cfg.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName;
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('认证管理');

  // --------------------------------------------------------------------------
  // auth login
  // --------------------------------------------------------------------------
  auth
    .command('login')
    .description('使用用户名/密码 + Google Authenticator 验证码登录')
    .addHelpText(
      'after',
      `
说明：
  登录成功后 accessToken 与 refreshToken 会保存到 ~/.cashop-console/config.json。
  后续请求过期时会自动刷新，refreshToken 轮换后也会被覆盖保存。

  首次用户（needSetup）：请先到运营管理后台 web 端完成密码重置与 Google
  Authenticator 绑定，再回 CLI 登录。

示例：
  $ cashop-console auth login
  $ cashop-console --env stable auth login
  $ cashop-console auth login --username alice --password '***' --totp 123456
`,
    )
    .option('--username <name>', '用户名（省略则交互输入）')
    .option('--password <password>', '密码（省略则交互输入，输入时不回显）')
    .option('--totp <code>', 'Google Authenticator 6 位验证码（省略则按需交互输入）')
    .action(
      async (
        options: { username?: string; password?: string; totp?: string },
        cmd: Command,
      ) => {
        const env = resolveEnv(cmd);
        const result = await runInternalLogin({
          env,
          username: options.username,
          password: options.password,
          totp: options.totp,
        });
        console.log(formatLoginSuccess(result.env, result.bundle));
      },
    );

  // --------------------------------------------------------------------------
  // auth logout
  // --------------------------------------------------------------------------
  auth
    .command('logout')
    .description('清除当前环境的登录态（会尽力通知服务端注销）')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const env = resolveEnv(cmd);
      const bundle = getAuth(env);
      if (!bundle) {
        console.log(chalk.yellow(`（${env} 环境未登录）`));
        return;
      }
      try {
        await logoutApi(env, bundle.accessToken);
      } catch {
        // server-side logout is best-effort
      }
      clearAuth(env);
      console.log(chalk.green(`✓ 已退出 ${env} 环境`));
    });

  // --------------------------------------------------------------------------
  // auth status
  // --------------------------------------------------------------------------
  auth
    .command('status')
    .description('查看当前登录状态（用户名、环境、accessToken 剩余时间）')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const env = resolveEnv(cmd);
      const bundle = getAuth(env);
      if (!bundle) {
        console.log(chalk.yellow('✗ 未登录'));
        console.log(`  请执行：cashop-console --env ${env} auth login`);
        return;
      }

      const remainingMin = Math.max(
        0,
        Math.round((bundle.expiresAt - Date.now()) / 60_000),
      );
      let displayName = bundle.username ?? 'unknown';
      try {
        const me = await getMe(env, bundle.accessToken);
        displayName = me.realName ?? me.username ?? displayName;
      } catch {
        // getMe is best-effort; we still show cached info on failure.
      }

      console.log(chalk.green(`✓ 已登录：${displayName}`));
      console.log(`  环境：${env}`);
      console.log(`  accessToken 剩余：${remainingMin} 分钟`);
    });

  // --------------------------------------------------------------------------
  // auth refresh
  // --------------------------------------------------------------------------
  auth
    .command('refresh')
    .description('显式刷新 accessToken（调试/诊断用）')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const env = resolveEnv(cmd);
      const bundle = getAuth(env);
      if (!bundle) {
        console.error(chalk.red('✗ 未登录，无法 refresh'));
        process.exit(1);
      }
      try {
        const res = await refreshAccessToken(env, bundle.refreshToken);
        if (!res.accessToken) {
          throw new Error('refresh 响应缺少 accessToken');
        }
        const next = {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken ?? bundle.refreshToken,
          expiresAt: Date.now() + (res.expiresIn ?? 0) * 1000,
          username: bundle.username,
          savedAt: Date.now(),
        };
        setAuth(env, next);
        const mins = Math.round((next.expiresAt - Date.now()) / 60_000);
        console.log(
          chalk.green(`✓ 已刷新（${env}，accessToken ${mins} 分钟后过期）`),
        );
      } catch (err) {
        clearAuth(env);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`✗ refresh 失败：${msg}`));
        console.error(`  已清除本地登录态，请重新 cashop-console --env ${env} auth login`);
        process.exit(1);
      }
    });
}
