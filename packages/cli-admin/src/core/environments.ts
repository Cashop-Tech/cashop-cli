export type EnvironmentName = 'stable' | 'prod';

export interface Environment {
  name: EnvironmentName;
  apiUrl: string;
}

const ENVIRONMENTS: Record<EnvironmentName, Environment> = {
  stable: {
    name: 'stable',
    apiUrl: 'https://api.castable.hk',
  },
  prod: {
    name: 'prod',
    apiUrl: 'https://api.cashop.com',
  },
};

export function getEnvironment(name: EnvironmentName): Environment {
  return ENVIRONMENTS[name];
}

export const DEFAULT_ENVIRONMENT: EnvironmentName = 'prod';
