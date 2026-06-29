# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). From the first
tagged release onward, this file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from Conventional
Commit messages.

## [0.1.0] - 2026-06-29

### Added

- Initial release of `compliance-constructs`.
- Eleven `Compliant*` constructs with SOC 2 safeguards baked in: `CompliantKey`,
  `CompliantBucket`, `CompliantLogBucket`, `CompliantTable`, `CompliantTopic`,
  `CompliantQueue`, `CompliantDLQ`, `CompliantFunction`, `CompliantScheduledLambda`,
  `CompliantApi`, and `CompliantVpc`, over shared `Unambiguous*` base classes.
- Example app (`ExampleStage`) deploying every construct across five stacks
  (network, storage, messaging, compute, api).
- cdk-nag `AwsSolutions` compliance gate enforced at synth time (aspect) and in
  CI (`test/compliance.test.ts`), with documented suppressions only.
- Agent and contributor documentation (`CLAUDE.md`, `AGENTS.md`, `docs/`).

[0.1.0]: https://github.com/ctrldeploy/compliance-constructs/releases/tag/v0.1.0
