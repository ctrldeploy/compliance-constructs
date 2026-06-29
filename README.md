# compliance-constructs

[![CI](https://github.com/ctrldeploy/compliance-constructs/actions/workflows/ci.yml/badge.svg)](https://github.com/ctrldeploy/compliance-constructs/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/compliance-constructs.svg)](https://www.npmjs.com/package/compliance-constructs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![cdk-nag: AwsSolutions](https://img.shields.io/badge/cdk--nag-AwsSolutions-blue.svg)](https://github.com/cdklabs/cdk-nag)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/ctrldeploy/compliance-constructs/badge)](https://scorecard.dev/viewer/?uri=github.com/ctrldeploy/compliance-constructs)

**Reusable AWS CDK constructs with SOC 2 safeguards pre-configured — and proven compliant by an automated [cdk-nag](https://github.com/cdklabs/cdk-nag) assessment that gates every build.**

Most "secure by default" libraries ask you to trust that the defaults are right. This one proves it: every example deployment is synthesized under the cdk-nag `AwsSolutions` rule pack, and the build fails on any unsuppressed finding. Each suppression that does exist is documented with an auditor-ready justification.

This is the engineering backbone of a fully-managed SOC 2 program for AWS — from implementation to audit. The constructs encode the controls; the assessment is the continuous evidence.

---

## Why this exists

SOC 2 Trust Services Criteria translate into a concrete set of infrastructure controls: encryption at rest and in transit, blocked public access, audit logging with retention, least-privilege IAM, point-in-time recovery, key rotation, and continuous monitoring. `compliance-constructs` bakes those controls into drop-in CDK constructs so teams get them by construction instead of by checklist — and the cdk-nag gate keeps them honest as the codebase grows.

| Trust Services Criteria | How it's enforced here |
| --- | --- |
| CC6.1 / CC6.7 — Logical access & encryption | KMS rotation, SSE everywhere, TLS enforced, public access blocked |
| CC7.2 — Monitoring | CloudWatch alarms on every stateful resource, VPC flow logs, API access logs |
| A1.2 — Availability / recovery | DynamoDB point-in-time recovery, DLQs, versioned buckets |
| CC6.6 — Boundary protection | WAF-associated API stages, restricted default security group, private subnets |

---

## Install

```bash
npm install compliance-constructs aws-cdk-lib constructs cdk-nag
```

`aws-cdk-lib`, `constructs`, and `cdk-nag` are peer dependencies.

## Usage

```ts
import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import {
    CompliantBucket,
    CompliantLogBucket,
    CompliantKey,
    UnambiguousStack,
} from 'compliance-constructs';

const app = new App();
Aspects.of(app).add(new AwsSolutionsChecks()); // continuous compliance gate

class MyStack extends UnambiguousStack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const key = new CompliantKey(this, 'key', props);            // rotation on
        const logs = new CompliantLogBucket(this, 'access-logs', props);
        new CompliantBucket(this, 'data', {
            ...props,
            encryptionKey: key,                                       // SSE-KMS
            serverAccessLogsBucket: logs.bucket,                      // audit logging
        });
    }
}
```

Every construct takes `DisambiguationProps & RemovalPolicyProps` (stage, region, account, removal policy) so the same definitions deploy cleanly across personal, staging, and production environments with safe, stage-aware retention.

---

## The constructs

| Construct | Wraps | SOC 2 safeguards baked in |
| --- | --- | --- |
| `CompliantKey` | KMS Key | Automatic key rotation; stage-aware removal policy |
| `CompliantBucket` | S3 Bucket | Block-all public access, SSE (S3 or KMS), TLS enforced, versioning, access logging, lifecycle, 4xx/5xx alarms |
| `CompliantLogBucket` | S3 Bucket | Hardened access-log sink (the one place AwsSolutions-S1 is suppressed, documented) |
| `CompliantTable` | DynamoDB Table | Point-in-time recovery, SSE (AWS-managed or CMK), on-demand billing, system-error alarm |
| `CompliantTopic` | SNS Topic | SSE (AWS-managed `aws/sns` key or CMK), TLS enforced |
| `CompliantQueue` | SQS Queue | SSE (SQS-managed or CMK), TLS enforced, always-attached DLQ, message-flow alarm |
| `CompliantDLQ` | SQS Queue | SSE, TLS enforced, depth alarms |
| `CompliantFunction` | Lambda Function | Least-privilege role (scoped log-group write, no broad managed policy), X-Ray tracing, encrypted log group with retention, ARM64, error/duration/throttle/memory alarms |
| `CompliantScheduledLambda` | EventBridge Scheduler + Lambda | Composes `CompliantFunction` + `CompliantDLQ`, scheduler role scoped to exact ARNs, DLQ-backed retries |
| `CompliantApi` | API Gateway REST + WAFv2 | Access + execution logging, request validation, IAM authorization, WAF-associated stage |
| `CompliantVpc` | EC2 VPC | Flow logs to retention-bound log group, restricted default SG, private egress subnets |

---

## The compliance gate

Compliance is enforced in two places, both required to pass:

1. **Synth-time aspect** — `applyComplianceChecks(app)` attaches `AwsSolutionsChecks` at App scope. cdk-nag emits CloudFormation **errors** on violations, so `cdk synth` and `cdk deploy` fail unless every resource is compliant or carries a documented suppression.
2. **CI test** — [`test/compliance.test.ts`](test/compliance.test.ts) synthesizes the full example stage and asserts, per stack, that `Annotations.fromStack(...).findError('*', /AwsSolutions-.*/)` (and `findWarning`) returns nothing.

```bash
npm test          # runs the cdk-nag gate + snapshot tests
npm run synth     # cdk synth — fails on any unsuppressed finding
```

### Documented suppressions

The only suppressions in this codebase are for things the consumer genuinely cannot harden, each justified inline and centralized in [`lib/compliance/suppressions.ts`](lib/compliance/suppressions.ts):

| Rule | Where | Justification |
| --- | --- | --- |
| `AwsSolutions-S1` | `CompliantLogBucket` | A central access-log sink cannot write access logs to itself. |
| `AwsSolutions-IAM4` / `IAM5` | `CompliantFunction` | Active X-Ray tracing attaches the AWS-managed tracing policy; X-Ray write actions are not resource-scopable by AWS design. |
| `AwsSolutions-IAM4` | `CompliantApi` | API Gateway requires the AWS-managed push-to-CloudWatch-Logs role to deliver logs — the logging control itself depends on it. |
| `AwsSolutions-IAM4` / `IAM5` / `L1` | CDK framework custom resources | S3 auto-delete and restrict-default-SG providers are generated and maintained by the CDK library, not consumer code. |

---

## Project structure

```
lib/
  index.ts                 public library barrel
  app.ts                   example App entry point (attaches the cdk-nag aspect)
  compliance/              applyComplianceChecks() aspect + documented suppressions
  constructs/              the Compliant* constructs + base classes
  deployments/pipeline.ts  ExampleStage wiring every construct across 5 stacks
  config/                  env-driven stage/region config (no secrets)
  stacks/                  example network / storage / messaging / compute / api stacks
test/
  compliance.test.ts       the cdk-nag gate
  snapshot.test.ts         CloudFormation drift snapshots
```

## Development

```bash
npm install
npm run typecheck     # strict tsc
npm run check         # biome lint + format
npm run build         # compile to dist/
npm test              # compliance gate + snapshots
npm run synth         # synth the example app under the aspect
```

## Contributing & community

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — dev setup, the compliance bar for changes, Conventional Commits.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor Covenant.
- [`SECURITY.md`](SECURITY.md) — how to report vulnerabilities privately.
- [`CHANGELOG.md`](CHANGELOG.md) — release history (automated via [release-please](https://github.com/googleapis/release-please)).
- Agent/contributor context lives in [`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/README.md).

Releases are SemVer, published to npm with [provenance](https://docs.npmjs.com/generating-provenance-statements) from a tagged GitHub release.

## License

MIT © 2026 Sanjay Shukla
