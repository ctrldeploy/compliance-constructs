# Documentation index

Context map for humans and agents. Start at the root `../CLAUDE.md`, then dive in as needed.

| Doc | Read it when you need to… |
| --- | --- |
| [`../CLAUDE.md`](../CLAUDE.md) | Get oriented fast: motivation, the one invariant, commands, conventions, how to add a construct. **Start here.** |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Understand the layering (app → pipeline → stacks → constructs), base classes, and key design decisions. |
| [`CONSTRUCTS.md`](CONSTRUCTS.md) | Look up a specific `Compliant*` construct: what it wraps, its safeguards, and the cdk-nag rules it satisfies. |
| [`COMPLIANCE.md`](COMPLIANCE.md) | Work on the cdk-nag gate, add/justify a suppression, or map SOC 2 criteria to controls. |
| [`../README.md`](../README.md) | See the public-facing story (this is the npm/GitHub front page). |

## Localized agent hints

Some directories carry their own `CLAUDE.md` with context specific to files in that folder:

- [`../lib/constructs/CLAUDE.md`](../lib/constructs/CLAUDE.md) — patterns for writing a compliant construct.
- [`../lib/compliance/CLAUDE.md`](../lib/compliance/CLAUDE.md) — how the gate and suppressions work.

## Repo map

```
CLAUDE.md / AGENTS.md   agent entry points (AGENTS.md → CLAUDE.md)
README.md / LICENSE     public-facing
docs/                   this folder — deep context
lib/
  index.ts              public library barrel
  app.ts                example App entry (attaches the cdk-nag aspect)
  compliance/           applyComplianceChecks() aspect + documented suppressions
  constructs/           the Compliant* constructs + base classes
  config/               env-driven stage/region config (no secrets)
  deployments/          ExampleStage wiring all constructs across 5 stacks
  stacks/               example network/storage/messaging/compute/api stacks
test/                   compliance.test.ts (the gate) + snapshot.test.ts
```
