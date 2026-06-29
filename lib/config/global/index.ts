/**
 * Global configuration for the compliance-constructs example app.
 *
 * Intentionally tiny and dependency-free: everything is read from the
 * environment so the library and its example deployment carry no hardcoded
 * account IDs, secrets, or business configuration.
 */

import { DEV, STAGES, type Stage } from '../stages';

/** Whether the example deploys to a personal/sandbox account (vs staging/prod). */
export function isLocalDeploy(): boolean {
    return (process.env.LOCAL_DEPLOY ?? 'true').toLowerCase() === 'true';
}

/** The deploying user / personal-stage disambiguator. */
export function getUser(): string {
    return process.env.USER || 'developer';
}

/** The target stage, resolved from the ENVIRONMENT env var (defaults to dev). */
export function getStage(): Stage {
    const env = (process.env.ENVIRONMENT || DEV).toLowerCase();
    return (STAGES as string[]).includes(env) ? (env as Stage) : DEV;
}
