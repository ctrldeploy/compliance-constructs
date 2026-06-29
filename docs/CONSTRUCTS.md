# Constructs reference

Every public construct, what it wraps, the safeguards it enforces, and the cdk-nag rules each satisfies. All live in `lib/constructs/` and are exported from `lib/constructs/index.ts`. Use `lib/constructs/bucket.construct.ts` as the quality bar when writing a new one.

Shared contract: every construct takes `DisambiguationProps & RemovalPolicyProps`. Encryptable constructs accept an optional `encryptionKey?: CompliantKey` to upgrade from AWS-managed SSE to a customer-managed key.

## Primitives & base classes

| Symbol | File | Role |
| --- | --- | --- |
| `UnambiguousConstruct` | `unambiguous.construct.ts` | Name disambiguation (`disambiguate()`) |
| `AlarmableUnambiguousConstruct` | `alarmable-unambiguous.construct.ts` | Adds `alarms[]` + `addAlarm()` / `getCriticalAlarms()` |
| `Alarmable` | `alarmable.construct.ts` | Interface for the above |
| `BasicAlarm` | `basic-alarm.construct.ts` | CloudWatch alarm wrapper (DESTROY removal) |
| `DisambiguationProps`, `RemovalPolicyProps`, `getRemovalPolicy`, `disambiguate` | `props/` | Shared prop mixins + helpers |

## Compliant constructs

### `CompliantKey` — `key.construct.ts` (KMS Key)
- Automatic key rotation; alias disambiguated by stage/region; stage-driven removal policy.
- Satisfies: **KMS5**. Used as the opt-in `encryptionKey` for the constructs below.

### `CompliantBucket` — `bucket.construct.ts` (S3 Bucket) — *the quality bar*
- Block-all public access; SSE (S3-managed, or KMS when `encryptionKey` given) with `bucketKeyEnabled`; `enforceSSL`; versioning on; noncurrent-version lifecycle (Intelligent-Tiering @30d, expire @90d); optional server access logging; 4xx/5xx alarms.
- Satisfies: **S1** (with a logs bucket), **S2**, **S5/S10**.

### `CompliantLogBucket` — `log-bucket.construct.ts` (S3 Bucket)
- A hardened `CompliantBucket` meant to receive other buckets' access logs.
- The **only** place `AwsSolutions-S1` is suppressed (a log sink can't log to itself) — documented inline.

### `CompliantTable` — `dynamodb.construct.ts` (DynamoDB Table)
- Point-in-time recovery; SSE (AWS-managed, or CUSTOMER_MANAGED with `encryptionKey`); on-demand billing; system-error alarm; `alarmActionsEnabled` prop (no `PROD` coupling).
- Satisfies: **DDB3**.

### `CompliantTopic` — `topic.construct.ts` (SNS Topic)
- SSE via `alias/aws/sns` by default (or a CMK); `enforceSSL`.
- Satisfies: **SNS2**, **SNS3**.

### `CompliantQueue` — `event-queue.construct.ts` (SQS Queue)
- SSE (SQS-managed or KMS); `enforceSSL`; **always attaches a `CompliantDLQ`**; 14-day retention; message-flow alarm.
- Satisfies: **SQS2/SQS2(SSE)**, **SQS3** (DLQ), **SQS4** (SSL).

### `CompliantDLQ` — `dlq.construct.ts` (SQS Queue)
- Same SSE + `enforceSSL`; depth alarms (low/high severity).
- Satisfies: **SQS2**, **SQS4**.

### `CompliantFunction` — `lambda.construct.ts` (Lambda Function)
- Least-privilege role: a pre-created, retention-bound **encrypted log group** with scoped `grantWrite` (no broad `AWSLambdaBasicExecutionRole`); active X-Ray tracing; ARM64; memory metric filters; error/duration/throttle/memory alarms. Environment is **entirely caller-supplied** (no business env injection). Runtime is caller-supplied — keep it current for **L1**.
- Suppressions (inline, documented): **IAM4/IAM5** for the X-Ray tracing policy (X-Ray actions aren't resource-scopable).

### `CompliantScheduledLambda` — `scheduled-lambda.construct.ts` (EventBridge Scheduler + Lambda)
- Composes `CompliantFunction` + `CompliantDLQ`; scheduler execution role scoped to the exact function and DLQ ARNs; DLQ-backed retry policy.

### `CompliantApi` — `api.construct.ts` (API Gateway REST + WAFv2)
- Access logging (retention-bound log group) + execution logging at INFO with metrics; default request validation; IAM authorization on methods; regional WAF WebACL associated to the stage (AWS Common Rule Set).
- Satisfies: **APIG1, APIG2, APIG3, APIG4, APIG6**. Suppression (inline): **IAM4** for the AWS-managed API Gateway → CloudWatch Logs role (the logging control requires it).

### `CompliantVpc` — `vpc.construct.ts` (EC2 VPC)
- VPC flow logs (ALL traffic) to a retention-bound log group; restricted default security group (via the `restrictDefaultSecurityGroup` feature flag in `cdk.json`); private egress subnets by default.
- Satisfies: **VPC7**.

## Mapping to the example stacks

| Stack (`lib/stacks/`) | Constructs |
| --- | --- |
| `network.stack.ts` | `CompliantVpc` |
| `storage.stack.ts` | `CompliantKey`, `CompliantLogBucket`, `CompliantBucket`, `CompliantTable` |
| `messaging.stack.ts` | `CompliantKey`, `CompliantTopic`, `CompliantQueue` (+ its `CompliantDLQ`) |
| `compute.stack.ts` | `CompliantFunction`, `CompliantScheduledLambda` |
| `api.stack.ts` | `CompliantApi` |
