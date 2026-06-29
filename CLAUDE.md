# CLAUDE.md

Agent entry point for `compliance-constructs`. Read this first; it links out to deeper context only when you need it.

## What this repo is

A TypeScript AWS CDK **library** of reusable constructs (`Compliant*`) that bake in SOC 2 safeguards by default, plus an **example app** that deploys every construct and proves compliance with an automated [cdk-nag](https://github.com/cdklabs/cdk-nag) assessment that gates the build.

**Motivation:** this is an open-source portfolio artifact and the engineering backbone of a fully-managed SOC 2 consulting offering for AWS (implementation → audit). The constructs encode the controls; the cdk-nag gate is the continuous evidence. Two implications for how you work here:
- **Correctness and auditability outrank cleverness.** Every safeguard must be demonstrable in the synthesized template, and every exception must be a documented suppression.
- **It must stay credible as a public showcase.** No secrets, no account-specific values, no dead code, clear naming.

## The one invariant you must not break

**The cdk-nag `AwsSolutions` gate must stay green.** Any new resource has to either be compliant or carry a documented suppression. Two enforcement points, both must pass:
1. Synth-time aspect (`lib/compliance/aspect.ts`) — `cdk synth` fails on any unsuppressed finding.
2. `test/compliance.test.ts` — asserts zero `findError`/`findWarning` matching `AwsSolutions-*` per stack.

If you add or change a construct, run `npm test` and `npm run synth` before declaring done. If a finding appears, **fix the resource** — only suppress when the consumer genuinely cannot harden it, and write the `reason` (see `lib/compliance/suppressions.ts` and the suppression table in `README.md`).

## Commands

```bash
npm install
npm run typecheck   # strict tsc, no emit
npm run check       # typecheck + biome lint/format (write)
npm run build       # compile lib/ -> dist/ (the published artifact)
npm test            # cdk-nag compliance gate + snapshot tests
npm run synth       # synth the example app under the aspect (must exit 0)
```

Re-run snapshots after an intentional infra change: `npx jest -u`.

> Sandbox note: if `node_modules/.bin` shims are broken in your environment, invoke directly: `node node_modules/typescript/bin/tsc`, `node node_modules/jest/bin/jest.js`, `node node_modules/aws-cdk/bin/cdk`.

## Architecture (the mental model)

Layered, dependency flows downward only:

```
app.ts                      App entry; attaches the cdk-nag aspect, routes to a deploy fn
  └─ deployments/pipeline.ts  ExampleStage: wires 5 stacks from a shared base-props object
       └─ stacks/*.stack.ts     thin: instantiate constructs, then suppressCdkManagedResources(this)
            └─ constructs/*      the Compliant* building blocks (where the safeguards live)
                 └─ constructs/{props,*base*}  disambiguation + removal-policy + alarm plumbing
config/        env-driven stage/region/account — NO hardcoded secrets
compliance/    the cdk-nag aspect + documented suppression helpers
```

Every construct takes `DisambiguationProps & RemovalPolicyProps` (stage, region, account, dev/prod removal policy) so the same definitions deploy across personal/staging/prod with safe naming and retention. Safeguards belong in the **construct**, never in the stack. Stacks stay thin.

Full detail: `docs/ARCHITECTURE.md`. Construct-by-construct reference: `docs/CONSTRUCTS.md`. How the gate works + every suppression: `docs/COMPLIANCE.md`.

## Conventions

- **Encryption default = AWS-managed/SSE; CMK is opt-in** via an optional `encryptionKey?: CompliantKey` prop. Don't force customer-managed keys.
- **Naming:** public constructs are `Compliant<Resource>`; base classes are `Unambiguous*` (name disambiguation) and `AlarmableUnambiguousConstruct` (adds alarms). These are part of the public API — renaming them is a breaking change.
- **Props pattern:** extend the CDK resource's `Props` (often `Partial<...>` and `Omit<..., 'encryptionKey'>` when the key type clashes), then `...props` spread first and override the safeguarded fields after.
- **Removal policy:** always go through `getRemovalPolicy(props)` — never hardcode `DESTROY`/`RETAIN`.
- **Alarms:** stateful constructs extend `AlarmableUnambiguousConstruct` and register alarms via `this.addAlarm(...)`.
- **Style:** biome, 4-space indent, single quotes, semicolons, 100-col. Run `npm run check`.
- **No secrets, ever.** Account/region come from `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION`. Grep gate before publishing (see `docs/COMPLIANCE.md`).

## Adding a new compliant construct (checklist)

1. Create `lib/constructs/<name>.construct.ts`, class `Compliant<Resource>` extending `AlarmableUnambiguousConstruct` (or `UnambiguousConstruct` if stateless).
2. Bake safeguards into the resource defaults; expose `encryptionKey?: CompliantKey` if it supports encryption.
3. Add a JSDoc block listing the safeguards and the cdk-nag rule IDs each satisfies.
4. Export it from `lib/constructs/index.ts`.
5. Instantiate it in the matching example stack under `lib/stacks/` (or a new one wired in `pipeline.ts`).
6. `npm test` + `npm run synth` → gate green. Suppress only what's truly unhardenable, with a `reason`.
7. Update `docs/CONSTRUCTS.md`, the README construct table, and (if suppressing) the suppression tables.

## Where to look

| Need | File |
| --- | --- |
| Quality bar for a resource construct | `lib/constructs/bucket.construct.ts` |
| Base classes / props / alarms | `lib/constructs/{unambiguous,alarmable-unambiguous,basic-alarm}.construct.ts`, `lib/constructs/props/` |
| The gate + suppressions | `lib/compliance/` |
| How stacks are wired | `lib/deployments/pipeline.ts` |
| The compliance test pattern | `test/compliance.test.ts` |
| Deep dives | `docs/ARCHITECTURE.md`, `docs/CONSTRUCTS.md`, `docs/COMPLIANCE.md` |
