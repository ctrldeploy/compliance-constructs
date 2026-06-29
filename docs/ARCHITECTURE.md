# Architecture

How the pieces fit together, and why. Read `CLAUDE.md` first for the rules of the road.

## Layers

Dependencies flow strictly downward — a lower layer never imports an upper one.

```
┌─ lib/app.ts ─────────────────────────────────────────────────────────────┐
│  Creates the CDK App, attaches the cdk-nag aspect at App scope, and routes │
│  to deployPersonal / deployStaging / deployProduction based on env vars.   │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
┌─ lib/deployments/pipeline.ts ──▼───────────────────────────────────────────┐
│  ExampleStage (extends Stage). Builds ONE base-props object                 │
│  (disambiguation + removal policy from the DeploymentConfig) and passes it  │
│  to all five stacks. This is where stage→region→account→removal is decided. │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
┌─ lib/stacks/*.stack.ts ────────▼───────────────────────────────────────────┐
│  Thin. Each stack: spread base props, instantiate constructs, then call     │
│  suppressCdkManagedResources(this). No safeguard logic lives here.          │
│  network · storage · messaging · compute · api                              │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
┌─ lib/constructs/*.construct.ts ▼───────────────────────────────────────────┐
│  The Compliant* building blocks. ALL safeguards live here.                  │
│  Base: UnambiguousConstruct → AlarmableUnambiguousConstruct                 │
│  Plumbing: props/ (DisambiguationProps, RemovalPolicyProps, getRemovalPolicy)│
│            basic-alarm.construct.ts                                          │
└─────────────────────────────────────────────────────────────────────────────┘

lib/config/      env-driven stage/region/account (no secrets)
lib/compliance/  applyComplianceChecks() aspect + suppressCdkManagedResources()
```

## Key design decisions

**Safeguards live in constructs, stacks stay thin.** A reviewer (human or agent) should be able to read one construct file and know every control it enforces. Stacks only compose. This is why `lib/stacks/*` are ~30 lines each.

**One base-props object threads stage/region/account/removal everywhere.** `DisambiguationProps` (stage, region, account, disambiguator) gives every resource a collision-free name across environments; `RemovalPolicyProps` + `getRemovalPolicy()` centralizes the DESTROY-in-dev / RETAIN-in-prod rule. Constructs never read global config — everything arrives through props, which keeps them pure and testable.

**Encryption is SSE-by-default, CMK-opt-in.** Every encryptable construct accepts `encryptionKey?: CompliantKey`. Absent it, the resource uses the free AWS-managed key (still passes cdk-nag); present it, the resource upgrades to a customer-managed key with rotation. This keeps the example cheap while showing the stronger story.

**The example is the test fixture.** `ExampleStage` is what `cdk synth` deploys *and* what `test/compliance.test.ts` synthesizes. There is no separate fixture to drift — the thing we ship is the thing we assess.

## Deployment topology

The five stacks have **no cross-stack references**, so CDK deploys them in parallel. They are split by concern (network / storage / messaging / compute / api) to demonstrate composition and to keep each example focused.

`app.ts` routing:
- `LOCAL_DEPLOY=true` (default) → `deployPersonal` (DEV stage, disambiguator = `$USER`).
- `ENVIRONMENT=staging|prod` with `LOCAL_DEPLOY=false` → `deployStaging` / `deployProduction`.

Account/region resolve from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` (see `lib/config/deployment.config.ts`). There are no hardcoded environment values.

## The base-class hierarchy

- `UnambiguousConstruct` — adds `disambiguate(name, dims)` so resource names embed stage/region and don't collide.
- `AlarmableUnambiguousConstruct` — adds an `alarms[]` collection + `addAlarm()` / `getCriticalAlarms()`. Stateful constructs extend this and register their CloudWatch alarms.
- `BasicAlarm` — the alarm primitive every construct uses; always `DESTROY` removal so alarms don't block teardown.
- `UnambiguousStack` — base Stack that disambiguates the stack name, enables cross-region references, and turns on termination protection when the prod removal policy is RETAIN.

## Build & packaging

- `tsc` compiles `lib/` → `dist/` (`rootDir: lib`, so `test/` is excluded from the build and type-checked by ts-jest instead).
- The npm package ships **only `dist/`** (plus README/LICENSE) via `files` in `package.json`. `aws-cdk-lib`, `constructs`, and `cdk-nag` are peer dependencies.
