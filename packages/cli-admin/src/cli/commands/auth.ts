import { Command } from 'commander';
import { resolveAuthContext } from '../../core/auth.js';
import { readConfig, setToken, clearToken, setConfigValue } from '../../core/config.js';
import { apiRequest } from '../../core/client.js';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from '../../core/environments.js';
import { decodeToken } from '../../core/token.js';
import { getUserInfo, getCurrentStation, updateStation } from '../../api/user.js';
import { formatJson } from '../../core/output.js';
import chalk from 'chalk';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('认证管理');

  // --------------------------------------------------------------------------
  // auth login
  // --------------------------------------------------------------------------
  auth
    .command('login')
    .description('登录 Cashop（支持内部用户和外部用户）')
    .addHelpText('after', `
登录方式：
  （默认）       打开浏览器进行 SSO 登录
  --token <t>   直接保存 Token（使用全局 --token 参数）
  --credential  在终端中使用用户名/密码登录（短信验证）

Token 登录示例：
  $ cashop-console auth login --token eyJ...        # 保存 Token 到 prod 环境
  $ cashop-console auth login --env stable --token eyJ...

如何获取 Token：
  1. 在浏览器中登录运营管理后台
  2. 打开开发者工具 (F12) → Application → Cookies
  3. 内部用户：复制 "X-AUTHENTICATION" 的值
  4. 外部用户：复制 32 位十六进制名称的 Cookie 值
`)
    .option('--credential', '使用用户名/密码方式登录')
    .action(async (options: { credential?: boolean }, cmd: Command) => {
      const globalOpts = cmd.parent!.parent!.opts<{
        env?: string;
        token?: string;
      }>();
      const env = (globalOpts.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName;
      const tokenArg = globalOpts.token;

      if (tokenArg) {
        // Direct token authentication
        const payload = decodeToken(tokenArg);
        const userType = payload?.userType ?? 'UNKNOWN';
        const userName = payload?.username ?? payload?.realname;

        try {
          // Try to verify token via user-info API
          const userInfo = await apiRequest<Record<string, unknown>>({
            env,
            token: tokenArg,
            method: 'GET',
            url: '/api/v1/login-user/user-info',
            baseUrlType: 'sso',
          });
          setToken(env, tokenArg);
          setConfigValue('env', env);
          const displayName = (userInfo.userName ?? userInfo.username ?? userInfo.realName ?? userName ?? 'unknown') as string;
          console.log(chalk.green(`✓ 已登录：${displayName}（${env}，${userType}）`));
        } catch {
          // user-info may fail for external users, but token could still be valid
          if (userName) {
            setToken(env, tokenArg);
            setConfigValue('env', env);
            console.log(chalk.green(`✓ 已登录：${userName}（${env}，${userType}）`));
            console.log(chalk.dim('  注意：user-info 接口不可用，Token 信息从 payload 中提取'));
          } else {
            console.error(chalk.red('✗ 无效 Token 或认证失败'));
            process.exit(1);
          }
        }
      } else if (options.credential) {
        // Username/password login via SSO VPN endpoint
        const { startCredentialLogin } = await import('../../core/credential-login.js');
        await startCredentialLogin(env);
      } else {
        // Default: browser-based SSO login
        const { startSsoLogin } = await import('../../core/sso-login.js');
        await startSsoLogin(env);
      }
    });

  // --------------------------------------------------------------------------
  // auth logout
  // --------------------------------------------------------------------------
  auth
    .command('logout')
    .description('清除当前环境的 Token')
    .action((_options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.parent!.parent!.opts<{ env?: string }>();
      const config = readConfig();
      const env = (
        globalOpts.env ?? config.env ?? DEFAULT_ENVIRONMENT
      ) as EnvironmentName;
      clearToken(env);
      console.log(chalk.green(`✓ 已退出 ${env} 环境`));
    });

  // --------------------------------------------------------------------------
  // auth status
  // --------------------------------------------------------------------------
  auth
    .command('status')
    .description('查看当前登录状态（用户名、环境、用户类型）')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.parent!.parent!.opts<{
        env?: string;
        token?: string;
      }>();
      const config = readConfig();
      const env = (
        globalOpts.env ?? config.env ?? DEFAULT_ENVIRONMENT
      ) as EnvironmentName;

      try {
        const { token } = resolveAuthContext({ env, token: globalOpts.token });
        const payload = decodeToken(token);
        const userType = payload?.userType ?? 'UNKNOWN';

        try {
          const userInfo = await getUserInfo({ env, token });
          const displayName = userInfo.username ?? userInfo.realname ?? payload?.username ?? payload?.realname ?? 'unknown';
          console.log(chalk.green(`✓ 已登录：${displayName}`));
          if (userInfo.currentStation) {
            console.log(`  当前站点：${userInfo.currentStation.stationCode}（${userInfo.currentStation.stationName}）`);
          }
        } catch {
          // user-info may fail for external users
          const name = payload?.username ?? payload?.realname ?? 'unknown';
          console.log(chalk.green(`✓ 已登录：${name}`));
        }
        console.log(`  环境：${env}`);
        console.log(`  用户类型：${userType}`);
      } catch {
        console.log(chalk.yellow('✗ 未登录'));
        console.log(`  请执行：cashop-console auth login --env ${env}`);
      }
    });

  // --------------------------------------------------------------------------
  // auth station (subcommand group)
  // --------------------------------------------------------------------------
  const station = auth.command('station').description('站点管理（查看/切换当前站点）');

  // auth station current
  station
    .command('current')
    .description('查看当前站点')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals<{ env?: string; token?: string; json?: boolean }>();
      const config = readConfig();
      const env = (globalOpts.env ?? config.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName;
      const { token } = resolveAuthContext({ env, token: globalOpts.token });

      const current = await getCurrentStation({ env, token });

      if (globalOpts.json) {
        console.log(formatJson(current));
        return;
      }

      console.log(`${chalk.cyan(current.stationCode)} ${chalk.dim(current.stationName)}`);
    });

  // auth station list
  station
    .command('list')
    .description('查看可用站点列表')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals<{ env?: string; token?: string; json?: boolean }>();
      const config = readConfig();
      const env = (globalOpts.env ?? config.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName;
      const { token } = resolveAuthContext({ env, token: globalOpts.token });

      const userInfo = await getUserInfo({ env, token });
      const currentCode = userInfo.currentStation?.stationCode;

      if (globalOpts.json) {
        console.log(formatJson({
          current: currentCode,
          stations: userInfo.stationList,
        }));
        return;
      }

      for (const s of userInfo.stationList ?? []) {
        const marker = s.stationCode === currentCode ? chalk.green(' ← 当前') : '';
        console.log(`  ${chalk.cyan(s.stationCode)} ${chalk.dim(s.stationName)}${marker}`);
      }
    });

  // auth station switch <stationCode>
  station
    .command('switch <stationCode>')
    .description('切换当前站点（自动校验权限）')
    .addHelpText('after', `
示例：
  $ cashop-console auth station switch JP
  $ cashop-console auth station switch GLOBAL
`)
    .action(async (stationCode: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals<{ env?: string; token?: string }>();
      const config = readConfig();
      const env = (globalOpts.env ?? config.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName;
      const { token } = resolveAuthContext({ env, token: globalOpts.token });

      try {
        await updateStation({ env, token }, stationCode);
        console.log(chalk.green(`✓ 已切换到站点：${stationCode}`));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`✗ ${message}`));
        process.exit(1);
      }
    });
}
