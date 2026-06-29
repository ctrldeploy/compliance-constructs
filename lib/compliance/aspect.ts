import { Aspects, type IAspect } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { IConstruct } from 'constructs';

/**
 * Attach the cdk-nag AwsSolutions rule pack to a scope (typically the App).
 *
 * AwsSolutionsChecks emits CDK *errors* on any unsuppressed finding, so
 * `cdk synth` / `cdk deploy` fail the build unless every resource is compliant
 * or carries a documented suppression. This is the synth-time half of the
 * compliance gate; `test/compliance.test.ts` is the CI half.
 */
export function applyComplianceChecks(scope: IConstruct, verbose = true): IAspect {
    const checks = new AwsSolutionsChecks({ verbose });
    Aspects.of(scope).add(checks);
    return checks;
}
