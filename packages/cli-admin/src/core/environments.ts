export type EnvironmentName = 'stable' | 'prod';

export interface Environment {
  name: EnvironmentName;
  apiUrl: string;
  ssoLoginUrl: string;
  /** URL that routes to security-sso-core for token exchange (code → token) */
  ssoCoreUrl: string;
}

const ENVIRONMENTS: Record<EnvironmentName, Environment> = {
  stable: {
    name: 'stable',
    apiUrl: 'https://api.castable.hk',
    ssoLoginUrl: 'https://login.castable.hk',
    ssoCoreUrl: 'https://sso-center-inner.castable.hk',
  },
  prod: {
    name: 'prod',
    apiUrl: 'https://api.cashop.com',
    ssoLoginUrl: 'https://login.cashop.com',
    ssoCoreUrl: 'https://sso-center-inner.cashop.com',
  },
};

export function getEnvironment(name: EnvironmentName): Environment {
  return ENVIRONMENTS[name];
}

export const DEFAULT_ENVIRONMENT: EnvironmentName = 'prod';
