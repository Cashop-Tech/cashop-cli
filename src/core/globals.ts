import { join } from 'node:path';
import { Config, loadConfig } from './config.js';
import { createLogger, Logger } from './logger.js';
import { TokenStore, InMemoryBackend, selectBackend } from './token-store.js';
import { AuthProvider, selectProvider } from './auth-provider/index.js';
import { BadArgsError } from './errors.js';

export interface GlobalFlags {
  env?: 'stable' | 'prod';
  json?: boolean;
  noColor?: boolean;
  verbose?: boolean;
  yes?: boolean;
  apiKey?: string;
}

export interface CliContext {
  env: 'stable' | 'prod';
  config: Config;
  baseUrl: string;
  store: TokenStore;
  provider: AuthProvider;
  logger: Logger;
  flags: GlobalFlags;
  outputMode: 'pretty' | 'json';
  homeDir: string;
}

export async function buildContext(input: {
  homeDir: string;
  flags: GlobalFlags;
  envVars: Record<string, string | undefined>;
}): Promise<CliContext> {
  const configPath = join(input.homeDir, '.cashop', 'config.yaml');
  const config = loadConfig(configPath);
  const env = input.flags.env ?? config.env;
  const base = env === 'stable' ? config.api.stable : config.api.prod;
  if (!base) throw new BadArgsError(`Environment '${env}' is not yet open. Use 'cashop config set env stable'.`);

  const logger = createLogger({ logDir: join(input.homeDir, '.cashop', 'logs'), verbose: !!input.flags.verbose });

  const backend = input.envVars.CASHOP_TEST_BACKEND === 'memory'
    ? new InMemoryBackend()
    : await selectBackend(input.envVars.CASHOP_PASSPHRASE ?? 'cashop-default');
  const store = new TokenStore(backend);

  const provider = await selectProvider({ env, store, flags: { apiKey: input.flags.apiKey }, envVars: input.envVars });

  return {
    env, config, baseUrl: base, store, provider, logger,
    flags: input.flags,
    outputMode: input.flags.json ? 'json' : config.output,
    homeDir: input.homeDir,
  };
}
