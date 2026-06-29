# AGENTS.md

This repo's agent guidance lives in [`CLAUDE.md`](CLAUDE.md) — read it first. It is the canonical context entry point regardless of which agent or tool you are.

Quick orientation:
- **What:** an open-source AWS CDK library of `Compliant*` constructs with SOC 2 safeguards baked in, plus an example app gated by a cdk-nag assessment.
- **The one invariant:** the cdk-nag `AwsSolutions` gate must stay green. After any change run `npm test` and `npm run synth`. Fix resources; suppress only what's genuinely unhardenable, with a documented `reason`.
- **Deeper context:** [`docs/`](docs/README.md) — architecture, per-construct reference, and the compliance model.
