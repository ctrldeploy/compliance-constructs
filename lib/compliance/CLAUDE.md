# lib/compliance — agent hints

The cdk-nag gate and the only sanctioned suppressions. Full model: [`../../docs/COMPLIANCE.md`](../../docs/COMPLIANCE.md).

## Files

- `aspect.ts` — `applyComplianceChecks(scope)` attaches `AwsSolutionsChecks` at App scope (called from `../app.ts`). This makes `cdk synth` fail on any unsuppressed finding.
- `suppressions.ts` — `suppressCdkManagedResources(stack)` suppresses CDK **framework-generated** custom-resource providers (S3 auto-delete, restrict-default-SG) that the consumer cannot harden. Every example stack calls it.

## Rules for changing suppressions

- A suppression is a last resort, not a fix. Default action for a new finding is to **harden the resource**.
- Only suppress when the control is structurally impossible to satisfy (a log sink can't log to itself; X-Ray actions only accept `*`; API Gateway needs the AWS-managed logging role).
- Every suppression needs a substantive `reason` (cdk-nag enforces a minimum length) and must be reflected in the suppression tables in `../../README.md` and `../../docs/COMPLIANCE.md`.
- Resource-specific suppressions belong **inline** in the construct (see `CompliantLogBucket`, `CompliantFunction`, `CompliantApi`). Only framework-level, path-based ones belong here.

## Don't

- Don't broaden a suppression to silence a real misconfiguration.
- Don't add new rule packs or change the aspect scope without updating `../../docs/COMPLIANCE.md` and `test/compliance.test.ts`.
