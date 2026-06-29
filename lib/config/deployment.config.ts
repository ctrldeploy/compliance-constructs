import { DEV, PROD, STAGING, type Stage } from './stages';

/**
 * Deployment configuration for a single stage.
 *
 * All values are resolved from the environment at synth time. There are no
 * hardcoded account IDs, domains, or secrets in this library — consumers wire
 * their own account via the standard CDK environment variables.
 */
export interface DeploymentConfig {
    readonly account: string;
    readonly region: string;
    readonly stage: Stage;
    readonly isProd: boolean;
}

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

/**
 * The deploying AWS account. Resolved from the standard CDK/AWS environment
 * variables; falls back to an unresolved token-safe placeholder for `cdk synth`
 * without credentials.
 */
export const AWS_ACCOUNT =
    process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || '000000000000';

export const DEV_REGION = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';
export const STAGING_REGION = process.env.STAGING_REGION || DEV_REGION;
export const PROD_REGION = process.env.PROD_REGION || DEV_REGION;

export const DEV_STAGE: DeploymentConfig = {
    account: AWS_ACCOUNT,
    region: DEV_REGION,
    stage: DEV,
    isProd: false,
};

export const STAGING_STAGE: DeploymentConfig = {
    account: AWS_ACCOUNT,
    region: STAGING_REGION,
    stage: STAGING,
    isProd: false,
};

export const PROD_STAGE: DeploymentConfig = {
    account: AWS_ACCOUNT,
    region: PROD_REGION,
    stage: PROD,
    isProd: true,
};
