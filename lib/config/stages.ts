export const STAGING = 'staging';
export const PROD = 'prod';
export const DEV = 'dev';

export type Stage = typeof STAGING | typeof PROD | typeof DEV;

export const STAGES: Stage[] = [STAGING, PROD, DEV];
