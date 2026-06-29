# Compliance model

How "SOC 2 by construction" is enforced and proven in this repo. The gate is the heart of the project — treat a red gate as a build failure, never as a thing to wave through.

## SOC 2 → controls → constructs

SOC 2 Trust Services Criteria map to concrete infrastructure controls, which map to the `Compliant*` constructs:


| Criteria      | Control                                                | Where enforced                                                                            |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| CC6.1 / CC6.7 | Encryption at rest & in transit; blocked public access | `CompliantBucket`, `CompliantTable`, `CompliantQueue`, `CompliantTopic`, `CompliantKey`   |
| CC6.6         | Boundary protection                                    | `CompliantApi` (WAF + IAM auth), `CompliantVpc` (restricted default SG, private subnets)  |
| CC7.2         | Monitoring / anomaly detection                         | CloudWatch alarms on every stateful construct; VPC flow logs; API access + execution logs |
| A1.2          | Availability & recovery                                | `CompliantTable` PITR; DLQs; versioned buckets                                            |


## The gate (two enforcement points, both required)

1. **Synth-time aspect** — `applyComplianceChecks(app)` in `lib/compliance/aspect.ts` attaches `AwsSolutionsChecks` at App scope. cdk-nag emits CloudFormation **errors** on violations, so `cdk synth` / `cdk deploy` fail unless every resource is compliant or suppressed.
2. **CI test** — `test/compliance.test.ts` synthesizes `ExampleStage` with the aspect and asserts, per stack, that `Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))` and `findWarning(...)` are both empty.

```bash
npm test          # the gate + snapshot drift tests
npm run synth     # synth under the aspect; must exit 0
```

## Suppressions — the rules

Suppress **only** when the consumer genuinely cannot harden the resource. Every suppression needs a real `reason` (cdk-nag enforces a minimum length) and must be mirrored in the README suppression table. Framework-level ones are centralized in `lib/compliance/suppressions.ts` via `suppressCdkManagedResources(stack)`, which every example stack calls.


| Rule                                | Where                          | Why it's allowed                                                                                                                               |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `AwsSolutions-S1`                   | `CompliantLogBucket`           | A central access-log sink cannot write its own access logs to itself.                                                                          |
| `AwsSolutions-IAM4` / `IAM5`        | `CompliantFunction`            | Active X-Ray tracing attaches the AWS-managed tracing policy; X-Ray write actions only accept `*` by AWS design.                               |
| `AwsSolutions-IAM4`                 | `CompliantApi`                 | API Gateway requires the AWS-managed push-to-CloudWatch-Logs account role to deliver logs — the logging control depends on it.                 |
| `AwsSolutions-IAM4` / `IAM5` / `L1` | CDK framework custom resources | `Custom::S3AutoDeleteObjects` and `Custom::VpcRestrictDefaultSG` providers are generated and maintained by the CDK library, not consumer code. |


When you add a construct and a finding appears: **fix the resource first.** Reach for a suppression only after confirming the control is structurally impossible to satisfy, and document why.

## Changing infrastructure safely

- After any construct change: `npm test` (gate + snapshots) and `npm run synth`.
- Intentional resource changes will fail the **snapshot** test — review the diff, then `npx jest -u` to re-baseline.
- The compliance test failing is never something to `-u` away; it means a real control regressed.

## No-secrets guarantee

This is a public repo on an evergreen account. Before publishing, confirm the tree is clean:

```bash
grep -rinE '[0-9]{12}|hooks\.slack\.com|aviato|proxycurl|mongodb|auth0|wafv2:[^ ]*[0-9]{12}' lib test *.json *.md | grep -v node_modules
```

Expect no matches. Account/region come from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` only.