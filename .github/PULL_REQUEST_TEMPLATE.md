<!--
PR title must follow Conventional Commits, e.g. "feat(bucket): add object-lock option".
Releases are automated from these by release-please.
-->

## What & why

<!-- What does this change and what problem does it solve? -->

## Type of change

- [ ] `fix` — bug fix (patch)
- [ ] `feat` — new construct or capability (minor)
- [ ] breaking change (`feat!` / `BREAKING CHANGE:`) (major)
- [ ] `docs` / `chore` / `test` / `ci` (no release)

## Compliance checklist

- [ ] Safeguards live in the construct, not the stack
- [ ] `npm run check` passes (typecheck + biome)
- [ ] `npm test` passes (cdk-nag gate + snapshots)
- [ ] `npm run synth` exits 0 with no AwsSolutions findings
- [ ] Any new suppression has a substantive `reason` and is added to the README + `docs/COMPLIANCE.md` tables
- [ ] JSDoc / `docs/CONSTRUCTS.md` / README updated
- [ ] No secrets, account IDs, or business-specific values introduced
